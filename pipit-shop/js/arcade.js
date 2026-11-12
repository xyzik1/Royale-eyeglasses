/* Royale Arcade: мини-игра «Пролети через ворота».
   Управление: клик / тап / пробел / ↑ / W. window.PipitArcade.mount(контейнер, пиксельная_птица) возвращает функцию закрытия. */
(function () {
  "use strict";

  var W = 300, H = 380;
  var GRAVITY = 900, FLAP = -290, SPEED = 105, GAP = 118, SPACING = 175, PW = 38;
  var BX = 70, BR = { w: 22, h: 18 };
  var LIVES = 3, INVULN = 1.6;
  var KEY = "pipit-arcade-top";
  var COL = { bg: "#8fbf9f", pipe: "#27371a", pipeLight: "#3f5a2a", ink: "#1b2a14", bird: "#1b2a14" };

  function getTop() { try { return +localStorage.getItem(KEY) || 0; } catch (e) { return 0; } }
  function setTop(v) { try { localStorage.setItem(KEY, String(v)); } catch (e) { /* без сохранения */ } }

  function birdSvg(sprite, fill) {
    var r = "";
    sprite.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) if (row[x] === "X") r += '<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02" fill="' + fill + '"/>';
    });
    return '<svg viewBox="0 -1 12 12" shape-rendering="crispEdges" aria-hidden="true">' + r + "</svg>";
  }

  function mount(body, sprite) {
    body.innerHTML =
      '<div class="arc" id="arc">' +
      '<canvas width="' + W + '" height="' + H + '" aria-label="Игра: пролетите птицей через ворота"></canvas>' +
      '<div class="ov" id="arcOv"><div class="top" id="arcTop"></div>' +
      '<div><div class="ttl">ROYALE</div><div class="sub" id="arcSub">Royale Arcade представляет</div></div>' +
      birdSvg(sprite, "#e6e6e6") +
      '<button type="button" class="go" id="arcGo">START GAME</button></div></div>';

    var root = body.querySelector("#arc"), cv = root.querySelector("canvas"), g = cv.getContext("2d");
    var ov = root.querySelector("#arcOv"), top = root.querySelector("#arcTop"), sub = root.querySelector("#arcSub"), go = root.querySelector("#arcGo");
    var best = getTop();
    var s = null, running = false, raf = 0, last = 0, disposed = false;

    function showMenu(over) {
      top.textContent = "TOPSCORE: " + best;
      sub.textContent = over ? "Счёт: " + s.score + " / ворот: " + s.gates : "Royale Arcade представляет";
      go.textContent = over ? "ЕЩЁ РАЗ" : "START GAME";
      ov.hidden = false;
      go.focus({ preventScroll: true });
    }
    showMenu(false);

    function newPipe(x) {
      return { x: x, cy: 85 + Math.random() * (H - 170), passed: false };
    }
    function start() {
      s = { y: H / 2, vy: FLAP * 0.7, pipes: [newPipe(W + 60), newPipe(W + 60 + SPACING), newPipe(W + 60 + SPACING * 2)], score: 0, gates: 0, lives: LIVES, inv: 0, t: 0 };
      ov.hidden = true;
      running = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
    function flap() {
      if (!running) return;
      s.vy = FLAP;
    }
    function lose() {
      s.lives--;
      if (s.lives <= 0) {
        running = false;
        if (s.score > best) { best = s.score; setTop(best); }
        draw();
        showMenu(true);
        return;
      }
      s.inv = INVULN;
      var next = s.pipes.filter(function (p) { return p.x + PW > BX - BR.w; })[0];
      s.y = next ? next.cy : H / 2;
      s.vy = 0;
    }

    function update(dt) {
      s.t += dt;
      s.vy += GRAVITY * dt;
      s.y += s.vy * dt;
      if (s.inv > 0) s.inv -= dt;
      s.pipes.forEach(function (p) { p.x -= SPEED * dt; });
      var first = s.pipes[0];
      if (first.x + PW < -4) { s.pipes.shift(); s.pipes.push(newPipe(s.pipes[s.pipes.length - 1].x + SPACING)); }
      s.pipes.forEach(function (p) {
        if (!p.passed && p.x + PW < BX - BR.w / 2) { p.passed = true; s.gates++; s.score += 10; }
      });
      if (s.inv > 0) { if (s.y < BR.h / 2) { s.y = BR.h / 2; s.vy = 0; } if (s.y > H - 10 - BR.h / 2) { s.y = H - 10 - BR.h / 2; s.vy = 0; } return; }
      var hit = s.y - BR.h / 2 < 0 || s.y + BR.h / 2 > H - 10;
      s.pipes.forEach(function (p) {
        if (BX + BR.w / 2 > p.x && BX - BR.w / 2 < p.x + PW) {
          if (s.y - BR.h / 2 < p.cy - GAP / 2 || s.y + BR.h / 2 > p.cy + GAP / 2) hit = true;
        }
      });
      if (hit) lose();
    }

    function heart(x, y, on) {
      var rows = ["01100110", "11111111", "11111111", "01111110", "00111100", "00011000"];
      g.fillStyle = on ? COL.ink : "rgba(27,42,20,.25)";
      rows.forEach(function (r, j) { for (var i = 0; i < 8; i++) if (r[i] === "1") g.fillRect(x + i * 2, y + j * 2, 2, 2); });
    }
    function pipe(p) {
      var t = p.cy - GAP / 2, b = p.cy + GAP / 2;
      g.fillStyle = COL.pipe;
      g.fillRect(p.x, 0, PW, t); g.fillRect(p.x, b, PW, H - b);
      g.fillRect(p.x - 4, t - 12, PW + 8, 12); g.fillRect(p.x - 4, b, PW + 8, 12);
      g.fillStyle = COL.pipeLight;
      g.fillRect(p.x + 5, 0, 4, t - 12); g.fillRect(p.x + 5, b + 12, 4, H - b - 12);
    }
    function drawBird() {
      if (s.inv > 0 && Math.floor(s.t * 14) % 2) return;
      var u = 3, w = 12 * u, h = 10 * u, ang = Math.max(-0.45, Math.min(0.7, s.vy / 500));
      g.save();
      g.translate(BX, s.y); g.rotate(ang); g.scale(-1, 1);
      g.fillStyle = COL.bird;
      sprite.forEach(function (row, y) {
        for (var x = 0; x < row.length; x++) if (row[x] === "X") g.fillRect(x * u - w / 2, y * u - h / 2, u, u);
      });
      g.restore();
    }
    function draw() {
      g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
      if (!s) return;
      s.pipes.forEach(pipe);
      g.fillStyle = COL.ink; g.fillRect(0, H - 10, W, 10);
      drawBird();
      g.fillStyle = COL.ink;
      g.textBaseline = "top";
      g.font = '700 18px "Pixelify Sans", monospace'; g.fillText("SCORE " + s.score, 10, 8);
      g.font = '400 14px "Pixelify Sans", monospace'; g.globalAlpha = .6; g.fillText(s.gates + " GATES", 10, 30); g.globalAlpha = 1;
      for (var i = 0; i < LIVES; i++) heart(W - 10 - (LIVES - i) * 20, 10, i < s.lives);
    }
    function frame(now) {
      if (disposed || !running) return;
      var dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      update(dt);
      if (running) { draw(); raf = requestAnimationFrame(frame); }
    }

    function onKey(e) {
      if (!running) return;
      if (e.code === "Space" || e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === "ц" || e.key === "Ц") { e.preventDefault(); flap(); }
    }
    function onDown(e) { if (running) { e.preventDefault(); flap(); } }
    go.addEventListener("click", start);
    cv.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    draw();

    return function dispose() {
      disposed = true; running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    };
  }

  window.PipitArcade = { mount: mount };
})();
