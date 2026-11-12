/* Royale: пиксельные шахматные фигуры (общие для кнопки на витрине и страницы chess.html).
   Силуэт задаётся сеткой 16x16: X тело, o деталь (глаз, щель, крест). Обводка строится автоматически. */
(function () {
  "use strict";
  var SPR = {
    p: [
      "................",
      "................",
      ".......XX.......",
      "......XXXX......",
      "......XXXX......",
      "......XXXX......",
      ".......XX.......",
      ".....XXXXXX.....",
      "......oooo......",
      ".......XX.......",
      "......XXXX......",
      ".....XXXXXX.....",
      "....XXXXXXXX....",
      "...XXXXXXXXXX...",
      "..XXXXXXXXXXXX..",
      "..XXXXXXXXXXXX.."],
    r: [
      "................",
      "..XXX.XXXX.XXX..",
      "..XXX.XXXX.XXX..",
      "..XXXXXXXXXXXX..",
      "...XXXXXXXXXX...",
      "....XXXXXXXX....",
      "....XXXXXXXX....",
      "....XXXXXXXX....",
      "....XXXXXXXX....",
      "....XXXXXXXX....",
      "...oooooooooo...",
      "...XXXXXXXXXX...",
      "..XXXXXXXXXXXX..",
      "..XXXXXXXXXXXX..",
      ".XXXXXXXXXXXXXX.",
      ".XXXXXXXXXXXXXX."],
    n: [
      "................",
      "......X.XX......",
      ".....XXXXXXX....",
      "....XXXXXXXXX...",
      "...XXXoXXXXXXX..",
      "..XXXXXXXXXXXX..",
      ".XXXXXXXXXXXXXX.",
      "XXXXXXXXXXXXXXX.",
      "XXXXXXXXXXXXXXX.",
      "XXXXoXXXXXXXXXX.",
      ".XXXXXXXXXXXXXX.",
      "...XXXXXXXXXXX..",
      "....XXXXXXXXXX..",
      "..XXXXXXXXXXXXX.",
      ".XXXXXXXXXXXXXXX",
      ".XXXXXXXXXXXXXXX"],
    b: [
      ".......XX.......",
      "......XXXX......",
      ".....XXXXXX.....",
      ".....XXXXoX.....",
      "....XXXXXoXX....",
      "....XXXXoXXX....",
      ".....XXXXXX.....",
      "......XXXX......",
      "....XXXXXXXX....",
      ".....oooooo.....",
      "......XXXX......",
      ".....XXXXXX.....",
      "....XXXXXXXX....",
      "...XXXXXXXXXX...",
      "..XXXXXXXXXXXX..",
      "..XXXXXXXXXXXX.."],
    q: [
      "................",
      ".X..X..XX..X..X.",
      ".XX.XX.XX.XX.XX.",
      "..XXXXXXXXXXXX..",
      "...XXXXXXXXXX...",
      "....XXXXXXXX....",
      ".....XXXXXX.....",
      ".....XXXXXX.....",
      "....oooooooo....",
      ".....XXXXXX.....",
      "....XXXXXXXX....",
      "...XXXXXXXXXX...",
      "..XXXXXXXXXXXX..",
      "..XXXXXXXXXXXX..",
      ".XXXXXXXXXXXXXX.",
      ".XXXXXXXXXXXXXX."],
    k: [
      ".......XX.......",
      ".....XXXXXX.....",
      ".......XX.......",
      "...XX.XXXX.XX...",
      "..XXXXXXXXXXXX..",
      "..XXXXXXXXXXXX..",
      "...XXXXXXXXXX...",
      ".....XXXXXX.....",
      "....oooooooo....",
      ".....XXXXXX.....",
      "....XXXXXXXX....",
      "...XXXXXXXXXX...",
      "..XXXXXXXXXXXX..",
      "..XXXXXXXXXXXX..",
      ".XXXXXXXXXXXXXX.",
      ".XXXXXXXXXXXXXX."]
  };
  var INK = "#1b1c1d", WHITE = "#ffffff", PAPER = "#e4e4e2";

  function cells(type) {
    var rows = SPR[type], body = [], det = [], set = {};
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) {
        var c = row[x];
        if (c === "X" || c === "o") { set[x + "," + y] = 1; (c === "o" ? det : body).push([x, y]); }
      }
    });
    function ring(src) {
      var out = {}, res = [];
      Object.keys(src).forEach(function (k) {
        var p = k.split(","), x = +p[0], y = +p[1];
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var kk = (x + dx) + "," + (y + dy);
          if (!src[kk] && !out[kk]) { out[kk] = 1; res.push([x + dx, y + dy, kk]); }
        }
      });
      return { list: res, set: out };
    }
    var o1 = ring(set), merged = {};
    Object.keys(set).forEach(function (k) { merged[k] = 1; });
    Object.keys(o1.set).forEach(function (k) { merged[k] = 1; });
    var o2 = ring(merged);
    return { body: body, det: det, outline: o1.list, halo: o2.list };
  }
  var CACHE = {};
  /* type: p r n b q k; color: "w" | "b"; opts.halo: белая «наклейка» вокруг (для кнопки на чёрно-белом фоне) */
  function svg(type, color, opts) {
    opts = opts || {};
    var key = type + color + (opts.halo ? "h" : "");
    if (CACHE[key]) return CACHE[key];
    var c = cells(type), w = color === "w";
    var body = w ? WHITE : INK, line = w ? INK : PAPER, det = w ? INK : PAPER;
    var s = '<svg viewBox="-2 -2 20 20" shape-rendering="crispEdges" aria-hidden="true">';
    function rects(list, fill) { return list.map(function (p) { return '<rect x="' + p[0] + '" y="' + p[1] + '" width="1.02" height="1.02" fill="' + fill + '"/>'; }).join(""); }
    if (opts.halo) s += rects(c.halo, WHITE);
    s += rects(c.outline, line) + rects(c.body, body) + rects(c.det, det) + "</svg>";
    CACHE[key] = s;
    return s;
  }
  window.RoyalePieces = { svg: svg };
})();
