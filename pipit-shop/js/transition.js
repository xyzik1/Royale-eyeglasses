/* Royale: переход между страницами «Очки» и «Шапки».
   Экран за ~0.65 с превращается в шахматное поле со сцены (плитки 60 px тех же цветов), впереди летит пиксельная птица.
   Страница меняется, пока экран закрыт, а на новой странице плитки так же исчезают за птицей. */
(function () {
  "use strict";
  var KEY = "royale-tr", T = 60, C1 = "#6d7073", C2 = "#e4e4e2", PX = 6;
  var BIRD = ["...XXXX.....", "..XXXXXXX...", "..XXX.XXXXX.", "..XXXXXXX...", ".XXXXXXXX...", "XXXXXXXXX...", ".XXXXXXX....", "..XXXXX.....", "...X..X.....", "..XX..XX...."];
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cv, ctx, win, bar, W, H, cols, rows, rnd, dir = 1, busy = false;

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function build(label) {
    cv = document.createElement("canvas");
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:2000";
    document.body.appendChild(cv);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / T); rows = Math.ceil(H / T);
    rnd = []; for (var n = 0; n < cols * rows; n++) rnd.push(Math.random());
    win = document.createElement("section");
    win.className = "win trwin";
    win.setAttribute("aria-hidden", "true");
    win.innerHTML = '<div class="tb"><div class="tt"><span>' + label + '</span></div></div><div class="body"><p>Загружаю раздел</p><div class="trbar"><i></i></div></div>';
    document.body.appendChild(win);
    bar = win.querySelector("i");
  }

  function clear() {
    if (cv) cv.remove();
    if (win) win.remove();
    cv = win = null; busy = false;
    document.documentElement.classList.remove("tr-in");
  }

  /* p: 0..1. cover=true плитки появляются, cover=false исчезают */
  function draw(p, cover) {
    ctx.clearRect(0, 0, W, H);
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var a = (dir > 0 ? i : cols - 1 - i) / Math.max(1, cols - 1);
        var t = a * 0.72 + rnd[j * cols + i] * 0.2;           // когда плитка меняется, 0…0.92
        var s = Math.max(0, Math.min(1, (p - t) / 0.08));
        s = Math.round(s * 3) / 3;                            // шаги, как в пиксель-арте
        if (!cover) s = 1 - s;
        if (s <= 0) continue;
        var k = T * s, o = (T - k) / 2;
        ctx.fillStyle = (i + j) % 2 ? C2 : C1;
        ctx.fillRect(i * T + o, j * T + o, k + 0.5, k + 0.5);
      }
    }
    /* птица летит вдоль фронта волны */
    var f = (p - 0.1) / 0.72, bw = 12 * PX;
    var x = dir > 0 ? f * W - bw / 2 : W - f * W - bw / 2;
    var y = H * 0.5 - 5 * PX + Math.sin(f * Math.PI * 6) * H * 0.05;
    if (x < -bw - 8 || x > W + 8) return;
    var pass;
    for (pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? "#1b1c1d" : "#ffffff";
      var g = pass ? 0 : 3;
      for (var r = 0; r < BIRD.length; r++) {
        for (var c = 0; c < 12; c++) {
          if (BIRD[r][c] !== "X") continue;
          var cx = dir > 0 ? c : 11 - c;
          ctx.fillRect(x + cx * PX - g, y + r * PX - g, PX + g * 2, PX + g * 2);
        }
      }
    }
  }

  function go(href, label, d) {
    if (busy) return;
    if (reduce) { location.href = href; return; }
    busy = true; dir = d;
    build(label);
    var t0 = performance.now(), D = 650;
    (function f(now) {
      var p = Math.min(1, (now - t0) / D);
      draw(ease(p), true);
      if (p > 0.5) win.classList.add("on");
      bar.style.width = Math.max(0, (p - 0.5) * 200) + "%";
      if (p < 1) { requestAnimationFrame(f); return; }
      try { sessionStorage.setItem(KEY, JSON.stringify({ dir: d, label: label })); } catch (e) { /* без записи */ }
      location.href = href;
      setTimeout(clear, 4000);                               // если переход не удался, не оставляем экран закрытым
    })(t0);
  }

  function arrive() {
    var s = null;
    try { s = JSON.parse(sessionStorage.getItem(KEY)); sessionStorage.removeItem(KEY); } catch (e) { s = null; }
    if (!s || reduce) { document.documentElement.classList.remove("tr-in"); return; }
    busy = true; dir = s.dir;
    build(s.label);
    draw(0, false);
    win.classList.add("on");
    bar.style.width = "100%";
    document.documentElement.classList.remove("tr-in");      // холст уже закрывает страницу
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var minWait = new Promise(function (r) { setTimeout(r, 450); });
    var cap = new Promise(function (r) { setTimeout(r, 2500); });
    Promise.race([Promise.all([ready, minWait]), cap]).then(function () {
      win.classList.remove("on");
      var t1 = performance.now(), D = 750;
      (function f(now) {
        var p = Math.min(1, (now - t1) / D);
        draw(ease(p), false);
        if (p < 1) requestAnimationFrame(f); else clear();
      })(t1);
    });
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-go]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    if (a.getAttribute("aria-current")) return;
    go(a.href, a.getAttribute("data-label") || "", +a.getAttribute("data-dir") || 1);
  });
  window.addEventListener("pageshow", function (e) { if (e.persisted) clear(); });   // кнопка «Назад»

  arrive();
})();
