/*
  Pipit: 3D-просмотр и AR-примерка очков.
  Подключается из main.js лениво (import("./tryon.js")), когда выбран товар с полем model.

  Как работает примерка:
  1. Камера (getUserMedia) показывается в <video>.
  2. MediaPipe Face Landmarker находит 468 точек лица в каждом кадре.
  3. По точкам считаем положение, поворот и размер головы и ставим на них модель очков (three.js).
  4. Невидимый «эллипсоид головы» закрывает дужки, когда голова повёрнута.
*/
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/* ---- настройки посадки (метры) ---- */
const FACE_WIDTH = 0.145;                          // ширина лица между точками 234 и 454
const MODEL_ANCHOR = new THREE.Vector3(0, 0.024, 0.062); // точка очков, которая встаёт на переносицу
const HEAD = { x: 0.066, y: 0.115, z: 0.095, cy: -0.015, cz: -0.095 }; // полуоси и центр «головы»-окклюдера

/* индексы точек лица MediaPipe */
const L_SIDE_A = 234, L_SIDE_B = 454, L_TOP = 10, L_CHIN = 152, L_BRIDGE_A = 168, L_BRIDGE_B = 6, L_NOSE_TIP = 1;

/* ---------- общее ---------- */
const modelCache = new Map();
function loadModel(url) {
  if (!modelCache.has(url)) {
    modelCache.set(url, new GLTFLoader().loadAsync(url).then((g) => { enhanceModel(g.scene); return g.scene; }).catch((e) => { modelCache.delete(url); throw e; }));
  }
  return modelCache.get(url);
}

/* ---------- реалистичные материалы ----------
   Применяется один раз к загруженной модели. Материалы определяем по имени и по свойствам:
   - линзы (в имени lens/glass): тонированное стекло с сильным отражением, сквозь него слегка видно глаза
   - металл (metalness > 0.5): логотипы, шарниры, декор: чёткие блики
   - всё остальное считаем оправой: глянцевый ацетат с лаковым слоем */
const LENS_RE = /lens|glass|линз|стекл/i;
const DECAL_RE = /print|logo|decal|label|text|принт|логотип/i;   // нанесения (текстуры с прозрачностью) не считаем стеклом
function toPhysical(m) {
  if (m.isMeshPhysicalMaterial) return m;
  const n = new THREE.MeshPhysicalMaterial();
  n.name = m.name;
  n.color.copy(m.color || new THREE.Color(0xffffff));
  n.map = m.map || null;
  n.normalMap = m.normalMap || null;
  n.roughnessMap = m.roughnessMap || null;
  n.metalnessMap = m.metalnessMap || null;
  n.roughness = m.roughness != null ? m.roughness : 0.5;
  n.metalness = m.metalness != null ? m.metalness : 0;
  n.transparent = m.transparent; n.opacity = m.opacity; n.alphaTest = m.alphaTest; n.side = m.side;
  return n;
}
function upgradeMaterial(m, look) {
  if (m.userData && m.userData.pipit) return m;
  const n = toPhysical(m);
  n.userData = Object.assign({}, n.userData, { pipit: true });
  const isDecal = DECAL_RE.test(m.name || "") || (!!m.map && m.transparent);
  const isLens = !isDecal && LENS_RE.test(m.name || "");
  if (isLens) {
    n.userData.lens = true;
    const ll = 0.2126 * n.color.r + 0.7152 * n.color.g + 0.0722 * n.color.b;
    if (ll < 0.01) n.color.setRGB(0.018, 0.021, 0.026);   // почти чёрное стекло оживляем серо-синим оттенком; цветное (зелёное) не трогаем
    n.metalness = 0;
    n.roughness = 0.03;
    n.opacity = m.transparent ? m.opacity : look.lensOpacity;
    n.transparent = true;
    n.depthWrite = false;
    n.side = THREE.DoubleSide;
    n.clearcoat = 1; n.clearcoatRoughness = 0.02;
    n.specularIntensity = 1;
    n.envMapIntensity = 2.2;
  } else if (isDecal) {
    /* логотип или надпись: тонкая плёнка поверх детали, без лака, без борьбы за глубину */
    n.userData.decal = true;
    n.transparent = true;
    n.depthWrite = false;
    n.polygonOffset = true; n.polygonOffsetFactor = -2; n.polygonOffsetUnits = -2;
    const shiny = n.metalness > 0.5;               // золотой/серебряный логотип остаётся металлическим
    n.roughness = shiny ? Math.min(Math.max(n.roughness, 0.18), 0.32) : Math.min(Math.max(n.roughness, 0.3), 0.55);
    n.clearcoat = 0;
    n.envMapIntensity = shiny ? 1.7 : 1.0;
    if (n.map) n.map.anisotropy = 16;
  } else if (n.metalness > 0.5) {
    n.roughness = Math.min(Math.max(n.roughness, 0.14), 0.32);
    n.envMapIntensity = 1.7;
  } else {
    /* глянцевый ацетат: почти чёрный цвет оживляем, чтобы форма читалась, и добавляем лак */
    const lum = 0.2126 * n.color.r + 0.7152 * n.color.g + 0.0722 * n.color.b;
    if (lum < 0.012) n.color.setRGB(0.012, 0.012, 0.014);
    n.roughness = Math.min(Math.max(n.roughness, 0.1), 0.3);
    n.clearcoat = Math.max(n.clearcoat || 0, 1);
    n.clearcoatRoughness = Math.min(n.clearcoatRoughness || 0.05, 0.04);
    n.specularIntensity = 1;
    n.envMapIntensity = 1.35;
  }
  [n.map, n.normalMap, n.roughnessMap, n.metalnessMap].forEach((t) => { if (t) t.anisotropy = 16; });
  n.needsUpdate = true;
  return n;
}
function enhanceModel(root, look) {
  look = Object.assign({ lensOpacity: 0.86 }, look || {});
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const many = Array.isArray(o.material);
    const out = (many ? o.material : [o.material]).map((m) => upgradeMaterial(m, look));
    o.material = many ? out : out[0];
    const hasLens = out.some((m) => m.userData.lens);
    const hasDecal = out.some((m) => m.userData.decal);
    if (hasLens) o.renderOrder = 3;               // стекло рисуем после оправы
    else if (hasDecal) o.renderOrder = 4;         // нанесения поверх стекла и оправы         // логотипы и прочие полупрозрачные детали
    o.castShadow = o.receiveShadow = false;
  });
}

function makeRenderer(canvas, extra) {
  const opts = Object.assign({}, extra || {});
  delete opts.supersample; delete opts.maxRatio;
  const r = new THREE.WebGLRenderer(Object.assign({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }, opts));
  r.setPixelRatio(Math.min((window.devicePixelRatio || 1) * ((extra && extra.supersample) || 1), (extra && extra.maxRatio) || 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1;
  return r;
}
/* комната для AR: нейтральное освещение «как в помещении» */
function makeEnv(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(new RoomEnvironment(), 0.03).texture;
  pm.dispose();
  return tex;
}
/* студия для 3D-просмотра и миниатюр: тёмная комната и несколько софтбоксов.
   Они дают на глянце длинные чёткие блики, как на настоящей предметной съёмке */
function makeStudioEnv(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: 0x2a2c2f, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, power, color) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color || 0xffffff).multiplyScalar(power), side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(x, y, z);
    p.lookAt(0, 0, 0);
    s.add(p);
  };
  panel(7, 3.4, 0, 5.4, 0.5, 10);                   // большой верхний софтбокс
  panel(1.4, 7, -5.4, 0.8, 1.5, 8, 0xf2f6ff);       // левая полоса, холодный свет
  panel(1.4, 7, 5.4, 0.8, 1, 6, 0xfff3e6);          // правая полоса, тёплый свет
  panel(8, 2.4, 0, 1.2, -5.4, 4);                   // контровой свет сзади
  panel(5, 2, 0, -0.5, 5.4, 1.6);                   // мягкий заполняющий спереди
  panel(10, 10, 0, -5.4, 0, 0.7, 0xc9c2b8);         // отражение от стола
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.015).texture;
  pm.dispose();
  s.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return tex;
}
function killRenderer(r) {
  try { r.dispose(); r.forceContextLoss(); } catch (e) { /* ignore */ }
}
function fitDist(size, aspect, fov) {
  const t = Math.tan((fov * Math.PI) / 360);
  return Math.max((Math.max(size.x, size.z) * 0.6) / (t * aspect), (size.y * 0.8) / t) + size.z * 0.5;
}
function userError(msg) { return Object.assign(new Error(msg), { userMessage: msg }); }

/* ---------- миниатюра для карточек ---------- */
export async function thumbnail(url, w = 720, h = 480) {
  const src = await loadModel(url);
  const canvas = document.createElement("canvas");
  const r = makeRenderer(canvas, { preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  const scene = new THREE.Scene();
  scene.environment = makeStudioEnv(r);
  const model = src.clone(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.position.sub(box.getCenter(new THREE.Vector3()));
  scene.add(model);
  const cam = new THREE.PerspectiveCamera(28, w / h, 0.01, 10);
  const d = fitDist(size, w / h, 28);
  cam.position.set(Math.sin(0.55) * d, 0.2 * d, Math.cos(0.55) * d);
  cam.lookAt(0, 0, 0);
  r.render(scene, cam);
  const data = canvas.toDataURL("image/png");
  scene.environment.dispose();
  killRenderer(r);
  return data;
}

/* ---------- 3D-просмотр ---------- */
export function mountViewer(container, product, hooks) {
  hooks = hooks || {};
  let dead = false, raf = 0, ro = null, controls = null, renderer = null, env = null, resume = 0;
  const canvas = document.createElement("canvas");
  canvas.className = "viewer";
  container.appendChild(canvas);

  const dispose = () => {
    dead = true;
    cancelAnimationFrame(raf);
    clearTimeout(resume);
    if (ro) ro.disconnect();
    if (controls) controls.dispose();
    if (env) env.dispose();
    if (renderer) killRenderer(renderer);
    canvas.remove();
  };

  const ready = (async () => {
    const src = await loadModel(product.model);
    if (dead) return;
    renderer = makeRenderer(canvas, { supersample: 1.5, maxRatio: 3 });   // 3D-просмотр рисуем с запасом по резкости
    renderer.toneMappingExposure = 0.95;
    const scene = new THREE.Scene();
    env = makeStudioEnv(renderer);
    scene.environment = env;
    const model = src.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(box.getCenter(new THREE.Vector3()));
    scene.add(model);

    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 10);
    const dir = new THREE.Vector3(Math.sin(0.6), 0.18, Math.cos(0.6)).normalize();
    controls = new OrbitControls(camera, canvas);
    canvas.style.touchAction = "pan-y"; // вертикальный свайп прокручивает страницу
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;
    controls.addEventListener("start", () => { controls.autoRotate = false; clearTimeout(resume); });
    controls.addEventListener("end", () => { resume = setTimeout(() => { controls.autoRotate = true; }, 2500); });

    const resize = () => {
      const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const d = fitDist(size, camera.aspect, 28);
      if (camera.position.lengthSq() === 0) camera.position.copy(dir).multiplyScalar(d);
      else camera.position.setLength(d);
    };
    resize();
    ro = new ResizeObserver(resize);
    ro.observe(container);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
    if (hooks.onStatus) hooks.onStatus("");
  })();

  return { dispose, ready };
}

/* ---------- сглаживание (One Euro) ---------- */
class OneEuro {
  constructor(minCutoff, beta) { this.min = minCutoff; this.beta = beta; this.t = null; this.x = 0; this.dx = 0; }
  static a(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  reset() { this.t = null; }
  filter(x, t) {
    if (this.t === null) { this.t = t; this.x = x; this.dx = 0; return x; }
    const dt = Math.max(1e-3, t - this.t);
    const dx = (x - this.x) / dt;
    this.dx += (dx - this.dx) * OneEuro.a(1, dt);
    const a = OneEuro.a(this.min + this.beta * Math.abs(this.dx), dt);
    this.x += (x - this.x) * a;
    this.t = t;
    return this.x;
  }
}

/* ---------- распознавание лица (общее на все сеансы) ---------- */
let landmarkerPromise = null;
function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const V = await import(VISION + "/vision_bundle.mjs");
      const files = await V.FilesetResolver.forVisionTasks(VISION + "/wasm");
      const make = (delegate) => V.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false
      });
      try { return await make("GPU"); } catch (e) { return await make("CPU"); }
    })().catch((e) => { landmarkerPromise = null; throw e; });
  }
  return landmarkerPromise;
}

function cameraMessage(e) {
  const n = e && e.name;
  if (n === "NotAllowedError" || n === "SecurityError") return "Доступ к камере запрещён. Разрешите его в настройках браузера";
  if (n === "NotFoundError" || n === "OverconstrainedError") return "Камера не найдена";
  if (n === "NotReadableError") return "Камера занята другим приложением";
  return "Не удалось включить камеру";
}

/* ---------- AR-примерка ---------- */
export function mountTryOn(container, product, hooks) {
  hooks = hooks || {};
  const say = (t) => { if (hooks.onStatus) hooks.onStatus(t); };
  const ar = Object.assign({ scale: 1, x: 0, y: 0, z: 0 }, product.ar || {});
  let dead = false, raf = 0, ro = null, stream = null, renderer = null, env = null, box = null, tune = null, shadowMat = null;

  const dispose = () => {
    dead = true;
    cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (env) env.dispose();
    if (shadowMat) { if (shadowMat.map) shadowMat.map.dispose(); shadowMat.dispose(); }
    if (renderer) killRenderer(renderer);
    if (box) box.remove();
    if (tune) tune.remove();
  };

  const ready = (async () => {
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw userError("Камера работает только на https или localhost");
    }
    say("Разрешите доступ к камере");
    const lmP = getLandmarker(), modelP = loadModel(product.model);
    lmP.catch(() => {}); modelP.catch(() => {});
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
    }).catch((e) => { throw userError(cameraMessage(e)); });
    if (dead) { s.getTracks().forEach((t) => t.stop()); return; }
    stream = s;

    say("Загружаю распознавание лица…");
    let landmarker, src;
    try { [landmarker, src] = await Promise.all([lmP, modelP]); }
    catch (e) { throw userError("Не удалось загрузить распознавание лица. Проверьте интернет"); }
    if (dead) return;

    /* видео и холст в одной рамке, зеркально, как в зеркале */
    box = document.createElement("div");
    box.className = "tryon-box";
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.autoplay = true;
    const canvas = document.createElement("canvas");
    box.append(video, canvas);
    container.appendChild(box);
    video.srcObject = stream;
    if (!video.videoWidth) await new Promise((res) => video.addEventListener("loadedmetadata", res, { once: true }));
    try { await video.play(); } catch (e) { throw userError("Не удалось запустить видео с камеры"); }
    if (dead) return;
    const vw = video.videoWidth, vh = video.videoHeight;

    /* сцена в пикселях видео: ортографическая камера, ось Z к зрителю */
    renderer = makeRenderer(canvas);
    const scene = new THREE.Scene();
    env = makeEnv(renderer);
    scene.environment = env;
    const camera = new THREE.OrthographicCamera(-vw / 2, vw / 2, vh / 2, -vh / 2, 1, 6000);
    camera.position.z = 3000;

    const root = new THREE.Group();   // система лица: метры, масштабируется в пиксели
    root.visible = false;
    scene.add(root);
    const glasses = src.clone(true);
    glasses.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    root.add(glasses);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ colorWrite: false }));
    head.scale.set(HEAD.x, HEAD.y, HEAD.z);
    head.position.set(0, HEAD.cy, HEAD.cz);
    head.renderOrder = -1;
    root.add(head);
    /* мягкая тень от очков на лице: тёмные размытые пятна под линзами и у переносицы */
    if (ar.shadow !== false) {
      const cv = document.createElement("canvas");
      cv.width = 512; cv.height = 256;
      const c = cv.getContext("2d");
      const blob = (x, y, rx, ry, a) => {
        c.save(); c.translate(x, y); c.scale(1, ry / rx);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, "rgba(0,0,0," + a + ")"); g.addColorStop(0.55, "rgba(0,0,0," + a * 0.55 + ")"); g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill(); c.restore();
      };
      blob(150, 128, 130, 95, 0.95); blob(362, 128, 130, 95, 0.95); blob(256, 105, 60, 45, 0.7);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      shadowMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.3, depthWrite: false });
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.085), shadowMat);
      shadow.position.set(0, -0.007, 0.004);
      shadow.renderOrder = 0;
      root.add(shadow);
    }
    const place = () => glasses.position.set(-MODEL_ANCHOR.x + ar.x, -MODEL_ANCHOR.y + ar.y, -MODEL_ANCHOR.z + ar.z);
    place();

    const fit = () => {
      const cw = Math.max(1, container.clientWidth), ch = Math.max(1, container.clientHeight);
      const k = Math.min(cw / vw, ch / vh);
      box.style.width = Math.floor(vw * k) + "px";
      box.style.height = Math.floor(vh * k) + "px";
      renderer.setSize(Math.floor(vw * k), Math.floor(vh * k), false);
    };
    fit();
    ro = new ResizeObserver(fit);
    ro.observe(container);

    /* поза по точкам лица */
    const P = (lm, i) => new THREE.Vector3((lm[i].x - 0.5) * vw, (0.5 - lm[i].y) * vh, -lm[i].z * vw);
    const fPos = [new OneEuro(1.0, 0.03), new OneEuro(1.0, 0.03), new OneEuro(1.0, 0.03)];
    const fScale = new OneEuro(0.8, 0.005);
    const fQuat = [0, 1, 2, 3].map(() => new OneEuro(1.6, 8));
    const prevQ = new THREE.Quaternion();
    let hasPrev = false;
    const resetFilters = () => { fPos.forEach((f) => f.reset()); fScale.reset(); fQuat.forEach((f) => f.reset()); hasPrev = false; };

    const applyPose = (lm, t) => {
      const xa = P(lm, L_SIDE_B).sub(P(lm, L_SIDE_A));
      const width = xa.length();
      xa.normalize();
      const ya = P(lm, L_TOP).sub(P(lm, L_CHIN));
      ya.addScaledVector(xa, -ya.dot(xa)).normalize();
      let za = new THREE.Vector3().crossVectors(xa, ya);
      /* страховка: ось Z должна смотреть от лица к носу (к камере), иначе очки окажутся задом наперёд */
      const sideMid = P(lm, L_SIDE_A).add(P(lm, L_SIDE_B)).multiplyScalar(0.5);
      if (za.dot(P(lm, L_NOSE_TIP).sub(sideMid)) < 0) { xa.negate(); za = new THREE.Vector3().crossVectors(xa, ya); }
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, ya, za));
      if (hasPrev && q.dot(prevQ) < 0) { q.x = -q.x; q.y = -q.y; q.z = -q.z; q.w = -q.w; }
      const pos = P(lm, L_BRIDGE_A).lerp(P(lm, L_BRIDGE_B), 0.5);

      root.position.set(fPos[0].filter(pos.x, t), fPos[1].filter(pos.y, t), fPos[2].filter(pos.z, t));
      root.scale.setScalar(fScale.filter((width / FACE_WIDTH) * ar.scale, t));
      root.quaternion.set(fQuat[0].filter(q.x, t), fQuat[1].filter(q.y, t), fQuat[2].filter(q.z, t), fQuat[3].filter(q.w, t)).normalize();
      prevQ.copy(root.quaternion);
      hasPrev = true;
    };

    /* подстраиваем яркость очков под освещение в кадре, чтобы они не выглядели наклеенными */
    const meterCv = document.createElement("canvas");
    meterCv.width = 16; meterCv.height = 9;
    const meterCtx = meterCv.getContext("2d", { willReadFrequently: true });
    let expo = 1, frames = 0;
    const meter = () => {
      try {
        meterCtx.drawImage(video, 0, 0, 16, 9);
        const d = meterCtx.getImageData(0, 0, 16, 9).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        const lum = sum / (144 * 255);
        const target = Math.min(1.45, Math.max(0.6, 0.55 + lum * 0.95));
        expo += (target - expo) * 0.25;
        renderer.toneMappingExposure = expo;
        if (shadowMat) shadowMat.opacity = 0.2 + 0.18 * Math.min(1, lum * 1.4);   // при ярком свете тень плотнее
      } catch (e) { /* без подстройки света */ }
    };

    let lastTime = -1, lost = 999;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (++frames % 20 === 1) meter();
      if (video.readyState >= 2 && video.currentTime !== lastTime) {
        lastTime = video.currentTime;
        const now = performance.now();
        let res = null;
        try { res = landmarker.detectForVideo(video, now); } catch (e) { res = null; }
        const lm = res && res.faceLandmarks && res.faceLandmarks[0];
        if (lm) {
          if (lost > 8) resetFilters();
          lost = 0;
          applyPose(lm, now / 1000);
          if (!root.visible) { root.visible = true; say(""); }
        } else if (++lost > 8 && root.visible) {
          root.visible = false;
          say("Наведите лицо на камеру");
        }
      }
      renderer.render(scene, camera);
    };
    say("Наведите лицо на камеру");
    tick();

    /* подгонка: откройте сайт с ?tune в адресе */
    if (new URLSearchParams(location.search).has("tune")) {
      tune = document.createElement("div");
      tune.className = "tune";
      const rows = [["scale", "размер", 0.7, 1.4, 0.01], ["x", "влево/вправо", -0.03, 0.03, 0.001], ["y", "вверх/вниз", -0.04, 0.04, 0.001], ["z", "вперёд/назад", -0.04, 0.04, 0.001]];
      const out = document.createElement("input");
      out.readOnly = true;
      const show = () => { out.value = "ar: { scale: " + ar.scale.toFixed(2) + ", x: " + ar.x.toFixed(3) + ", y: " + ar.y.toFixed(3) + ", z: " + ar.z.toFixed(3) + " }"; };
      rows.forEach((r) => {
        const l = document.createElement("label");
        l.textContent = r[1];
        const i = document.createElement("input");
        i.type = "range"; i.min = r[2]; i.max = r[3]; i.step = r[4]; i.value = ar[r[0]];
        i.addEventListener("input", () => { ar[r[0]] = parseFloat(i.value); place(); show(); });
        l.appendChild(i);
        tune.appendChild(l);
      });
      show();
      tune.appendChild(out);
      container.appendChild(tune);
    }
  })();

  return { dispose, ready };
}
