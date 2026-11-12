/* Royale: шахматы. Правила: ходы, рокировка, взятие на проходе, превращение, шах, мат, пат, ничьи.
   Соперник: перебор с альфа-бета отсечением (3 уровня силы). Режимы: против компьютера, вдвоём на одном экране и онлайн по коду комнаты (Supabase Realtime, см. блок «онлайн» ниже). Открывается поверх сцены товара (оверлей), фигуры пиксельные (js/pieces.js). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var VAL = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
  var RU = { k: "Кр", q: "Ф", r: "Л", b: "С", n: "К", p: "" };
  var FILES = "abcdefgh";
  /* оценка позиции по клеткам: лучше центр, пешки вперёд (для белых, для чёрных зеркально) */
  var PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  };

  /* ---------- состояние ---------- */
  function start() {
    var b = new Array(64).fill(null), back = "rnbqkbnr", i;
    for (i = 0; i < 8; i++) { b[i] = "b" + back[i]; b[8 + i] = "bp"; b[48 + i] = "wp"; b[56 + i] = "w" + back[i]; }
    return { b: b, t: "w", c: { wK: 1, wQ: 1, bK: 1, bQ: 1 }, ep: -1, hm: 0, fm: 1 };
  }
  function copy(s) { return { b: s.b.slice(), t: s.t, c: { wK: s.c.wK, wQ: s.c.wQ, bK: s.c.bK, bQ: s.c.bQ }, ep: s.ep, hm: s.hm, fm: s.fm }; }
  function other(c) { return c === "w" ? "b" : "w"; }
  function sq(r, c) { return r * 8 + c; }
  function name(i) { return FILES[i % 8] + (8 - Math.floor(i / 8)); }

  var KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  var KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var DG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], ST = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function attacked(b, i, by) {
    var r = Math.floor(i / 8), c = i % 8, k, p, rr, cc, d;
    var pr = by === "w" ? r + 1 : r - 1;                           // откуда бьёт пешка
    if (pr >= 0 && pr < 8) for (k = -1; k <= 1; k += 2) { cc = c + k; if (cc >= 0 && cc < 8 && b[sq(pr, cc)] === by + "p") return true; }
    for (k = 0; k < 8; k++) {
      rr = r + KN[k][0]; cc = c + KN[k][1];
      if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[sq(rr, cc)] === by + "n") return true;
      rr = r + KG[k][0]; cc = c + KG[k][1];
      if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[sq(rr, cc)] === by + "k") return true;
    }
    for (d = 0; d < 8; d++) {
      var v = d < 4 ? DG[d] : ST[d - 4]; rr = r + v[0]; cc = c + v[1];
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
        p = b[sq(rr, cc)];
        if (p) { if (p[0] === by && (p[1] === "q" || p[1] === (d < 4 ? "b" : "r"))) return true; break; }
        rr += v[0]; cc += v[1];
      }
    }
    return false;
  }
  function kingSq(b, col) { for (var i = 0; i < 64; i++) if (b[i] === col + "k") return i; return -1; }
  function inCheck(s, col) { return attacked(s.b, kingSq(s.b, col), other(col)); }

  /* псевдолегальные ходы; fullPromo: все четыре превращения (для игрока), иначе только ферзь */
  function gen(s, fullPromo) {
    var out = [], b = s.b, me = s.t, you = other(me), i, r, c, p, k, rr, cc, t, d;
    function add(from, to, extra) {
      var m = { from: from, to: to, piece: b[from], cap: b[to] || null };
      if (extra) for (var key in extra) m[key] = extra[key];
      out.push(m);
    }
    for (i = 0; i < 64; i++) {
      p = b[i]; if (!p || p[0] !== me) continue;
      r = Math.floor(i / 8); c = i % 8; t = p[1];
      if (t === "p") {
        var dir = me === "w" ? -1 : 1, startR = me === "w" ? 6 : 1, lastR = me === "w" ? 0 : 7;
        rr = r + dir;
        if (rr >= 0 && rr < 8 && !b[sq(rr, c)]) {
          pushPawn(i, sq(rr, c), rr === lastR);
          if (r === startR && !b[sq(rr + dir, c)]) add(i, sq(rr + dir, c), { dbl: true });
        }
        for (k = -1; k <= 1; k += 2) {
          cc = c + k; if (cc < 0 || cc > 7 || rr < 0 || rr > 7) continue;
          t = sq(rr, cc);
          if (b[t] && b[t][0] === you) pushPawn(i, t, rr === lastR);
          else if (t === s.ep) add(i, t, { ep: true, cap: you + "p" });
        }
      } else if (t === "n" || t === "k") {
        var list = t === "n" ? KN : KG;
        for (k = 0; k < 8; k++) {
          rr = r + list[k][0]; cc = c + list[k][1];
          if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
          d = b[sq(rr, cc)]; if (!d || d[0] === you) add(i, sq(rr, cc));
        }
        if (t === "k") castle(i, me, you);
      } else {
        var from = t === "b" ? 0 : t === "r" ? 4 : 0, to = t === "b" ? 4 : t === "r" ? 8 : 8;
        for (k = from; k < to; k++) {
          var v = k < 4 ? DG[k] : ST[k - 4]; rr = r + v[0]; cc = c + v[1];
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
            d = b[sq(rr, cc)];
            if (!d) add(i, sq(rr, cc));
            else { if (d[0] === you) add(i, sq(rr, cc)); break; }
            rr += v[0]; cc += v[1];
          }
        }
      }
    }
    function pushPawn(from, to, promo) {
      if (!promo) { add(from, to); return; }
      (fullPromo ? ["q", "r", "b", "n"] : ["q"]).forEach(function (x) { add(from, to, { promo: x }); });
    }
    function castle(i, me, you) {
      var row = me === "w" ? 7 : 0;
      if (i !== sq(row, 4) || attacked(b, i, you)) return;
      if (s.c[me + "K"] && b[sq(row, 7)] === me + "r" && !b[sq(row, 5)] && !b[sq(row, 6)] && !attacked(b, sq(row, 5), you) && !attacked(b, sq(row, 6), you)) add(i, sq(row, 6), { castle: "K" });
      if (s.c[me + "Q"] && b[sq(row, 0)] === me + "r" && !b[sq(row, 1)] && !b[sq(row, 2)] && !b[sq(row, 3)] && !attacked(b, sq(row, 3), you) && !attacked(b, sq(row, 2), you)) add(i, sq(row, 2), { castle: "Q" });
    }
    return out;
  }

  function apply(s, m) {
    var n = copy(s), b = n.b, me = s.t, row = me === "w" ? 7 : 0;
    b[m.to] = m.promo ? me + m.promo : m.piece; b[m.from] = null;
    if (m.ep) b[m.to + (me === "w" ? 8 : -8)] = null;
    if (m.castle === "K") { b[sq(row, 5)] = b[sq(row, 7)]; b[sq(row, 7)] = null; }
    if (m.castle === "Q") { b[sq(row, 3)] = b[sq(row, 0)]; b[sq(row, 0)] = null; }
    n.ep = m.dbl ? (m.from + m.to) / 2 : -1;
    if (m.piece[1] === "k") { n.c[me + "K"] = 0; n.c[me + "Q"] = 0; }
    [[56, "wQ"], [63, "wK"], [0, "bQ"], [7, "bK"]].forEach(function (x) { if (m.from === x[0] || m.to === x[0]) n.c[x[1]] = 0; });
    n.hm = (m.piece[1] === "p" || m.cap) ? 0 : s.hm + 1;
    if (me === "b") n.fm++;
    n.t = other(me);
    return n;
  }
  function legal(s, fullPromo) {
    return gen(s, fullPromo).filter(function (m) { return !inCheck(apply(s, m), s.t); });
  }

  /* ---------- запись хода ---------- */
  function san(s, m, moves) {
    if (m.castle) return m.castle === "K" ? "O-O" : "O-O-O";
    var t = m.piece[1], txt = RU[t];
    if (t === "p") { if (m.cap) txt = FILES[m.from % 8]; }
    else {
      var same = moves.filter(function (o) { return o.from !== m.from && o.to === m.to && o.piece === m.piece; });
      if (same.length) {
        var sf = same.some(function (o) { return o.from % 8 === m.from % 8; }), sr = same.some(function (o) { return Math.floor(o.from / 8) === Math.floor(m.from / 8); });
        if (!sf) txt += FILES[m.from % 8]; else if (!sr) txt += 8 - Math.floor(m.from / 8); else txt += name(m.from);
      }
    }
    if (m.cap) txt += "x";
    txt += name(m.to);
    if (m.promo) txt += "=" + RU[m.promo];
    var n = apply(s, m), chk = inCheck(n, n.t);
    if (chk) txt += legal(n).length ? "+" : "#";
    return txt;
  }

  /* ---------- конец игры ---------- */
  function key(s) { return s.b.map(function (x) { return x || "."; }).join("") + s.t + s.c.wK + s.c.wQ + s.c.bK + s.c.bQ + s.ep; }
  function insufficient(b) {
    var minor = 0, i, p;
    for (i = 0; i < 64; i++) { p = b[i]; if (!p || p[1] === "k") continue; if (p[1] === "p" || p[1] === "r" || p[1] === "q") return false; minor++; }
    return minor <= 1;
  }

  /* ---------- компьютер ---------- */
  function evaluate(s) {
    var sc = 0, i, p, v;
    for (i = 0; i < 64; i++) {
      p = s.b[i]; if (!p) continue;
      v = VAL[p[1]] + (p[0] === "w" ? PST[p[1]][i] : PST[p[1]][56 - i + 2 * (i % 8)]);   // зеркало по вертикали
      sc += p[0] === "w" ? v : -v;
    }
    return sc;
  }
  function order(ms) {
    return ms.sort(function (a, b) {
      return ((b.cap ? VAL[b.cap[1]] * 10 - VAL[b.piece[1]] : 0) + (b.promo ? 800 : 0)) - ((a.cap ? VAL[a.cap[1]] * 10 - VAL[a.piece[1]] : 0) + (a.promo ? 800 : 0));
    });
  }
  function search(s, depth, alpha, beta, ply) {
    var ms = legal(s);
    if (!ms.length) return inCheck(s, s.t) ? (s.t === "w" ? -100000 + ply : 100000 - ply) : 0;
    if (s.hm >= 100) return 0;
    if (depth === 0) return evaluate(s);
    order(ms);
    var best, i, v;
    if (s.t === "w") {
      best = -Infinity;
      for (i = 0; i < ms.length; i++) { v = search(apply(s, ms[i]), depth - 1, alpha, beta, ply + 1); if (v > best) best = v; if (best > alpha) alpha = best; if (alpha >= beta) break; }
    } else {
      best = Infinity;
      for (i = 0; i < ms.length; i++) { v = search(apply(s, ms[i]), depth - 1, alpha, beta, ply + 1); if (v < best) best = v; if (best < beta) beta = best; if (alpha >= beta) break; }
    }
    return best;
  }
  var LEVELS = { 1: { depth: 1, noise: 90 }, 2: { depth: 2, noise: 25 }, 3: { depth: 3, noise: 0 } };
  function pickMove(s, level) {
    var L = LEVELS[level], ms = order(legal(s)), best = null, bv = s.t === "w" ? -Infinity : Infinity, i, v;
    for (i = 0; i < ms.length; i++) {
      v = search(apply(s, ms[i]), L.depth - 1, -Infinity, Infinity, 1) + (Math.random() - 0.5) * L.noise;
      if (s.t === "w" ? v > bv : v < bv) { bv = v; best = ms[i]; }
    }
    return best;
  }

  /* ---------- интерфейс (оверлей поверх сцены) ---------- */
  var G = { s: null, hist: [], moves: [], sel: -1, targets: [], last: null, human: "w", level: 2, mode: "ai", autoFlip: false, flip: false, over: false, thinking: false, reps: {}, pending: null, token: 0, netMsg: "", pre: null, pendingPre: false };
  var NET = null, RT = null;
  var root = null, boardEl, statusEl, capW, capB, promoEl, opener = null;

  function build() {
    var stage = document.querySelector(".stage");
    if (!stage) return false;
    root = document.createElement("div");
    root.className = "chessgame"; root.id = "chessGame"; root.hidden = true;
    root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Шахматы");
    root.innerHTML =
      '<div class="cg-top">' +
        '<div class="cg-title">Шахматы</div>' +
        '<div class="seg" id="segMode" role="group" aria-label="Режим игры"><button type="button" data-v="ai" aria-pressed="true">Против компьютера</button><button type="button" data-v="pvp" aria-pressed="false">Вдвоём</button><button type="button" data-v="online" aria-pressed="false">По коду</button></div>' +
        '<button type="button" class="cg-x" id="cgClose" aria-label="Закрыть шахматы">&times;</button>' +
      '</div>' +
      '<div class="cg-body">' +
        '<div class="cwrap"><div class="cboard" id="board" role="group" aria-label="Доска"></div><div class="cpromo" id="promo" hidden></div></div>' +
        '<div class="cg-panel">' +
          '<div class="cstatus" id="status" role="status" aria-live="polite"></div>' +
          '<div class="cbtns"><button type="button" class="cbtn pri" id="newGame">Новая игра</button><button type="button" class="cbtn" id="undo" disabled>Отменить ход</button><button type="button" class="cbtn" id="flip">Перевернуть</button><button type="button" class="cbtn" id="pgn" disabled title="Скопировать партию в формате PGN">PGN</button></div>' +
          '<div class="cset" id="rowSide"><span>Играть</span><div class="seg" id="segSide" role="group" aria-label="Цвет фигур"><button type="button" data-v="w" aria-pressed="true">белыми</button><button type="button" data-v="b" aria-pressed="false">чёрными</button></div></div>' +
          '<div class="cset" id="rowLevel"><span>Сила</span><div class="seg" id="segLevel" role="group" aria-label="Сила компьютера"><button type="button" data-v="1" aria-pressed="false">Лёгкая</button><button type="button" data-v="2" aria-pressed="true">Средняя</button><button type="button" data-v="3" aria-pressed="false">Сильная</button></div></div>' +
          '<div class="cset" id="rowTurn" hidden><span>Доска</span><div class="seg" id="segTurn" role="group" aria-label="Поворот доски"><button type="button" data-v="0" aria-pressed="true">Не крутить</button><button type="button" data-v="1" aria-pressed="false">За ходом</button></div></div>' +
          '<div class="cnet" id="rowNet" hidden>' +
            '<div id="netLobby"><button type="button" class="cbtn pri" id="netCreate">Создать комнату</button>' +
              '<div class="cjoin"><input id="netCode" maxlength="40" placeholder="КОД" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Код комнаты"><button type="button" class="cbtn" id="netJoin">Войти</button></div>' +
              '<p class="cnote">Создайте комнату и отправьте код другу или введите код, который прислали вам. Цвет выбирает тот, кто создаёт комнату.</p></div>' +
            '<div id="netRoom" hidden><div class="ccode"><span>Код комнаты</span><b id="netCodeShow" title="Нажмите, чтобы скопировать код">—</b></div>' +
              '<div class="cbtns"><button type="button" class="cbtn" id="netCopyLink">Копировать ссылку</button><button type="button" class="cbtn" id="netDraw">Предложить ничью</button><button type="button" class="cbtn" id="netResign">Сдаться</button><button type="button" class="cbtn" id="netLeave">Выйти</button></div>' +
              '<div class="cwho" id="netWho"></div></div>' +
          '</div>' +
          '<div class="ccap"><div><span>Потеряно белыми</span><div class="caps" id="capW"></div></div><div><span>Потеряно чёрными</span><div class="caps" id="capB"></div></div></div>' +
        '</div>' +
      '</div>';
    stage.appendChild(root);
    boardEl = $("board"); statusEl = $("status"); capW = $("capW"); capB = $("capB"); promoEl = $("promo");
    bind();
    return true;
  }

  function pieceHTML(p) { return window.RoyalePieces.svg(p[1], p[0]); }
  function colName(c) { return c === "w" ? "белые" : "чёрные"; }
  function drawBoard() {
    var html = "", s = G.s, chkSq = -1;
    if (inCheck(s, s.t)) chkSq = kingSq(s.b, s.t);
    for (var rr = 0; rr < 8; rr++) {
      for (var cc = 0; cc < 8; cc++) {
        var r = G.flip ? 7 - rr : rr, c = G.flip ? 7 - cc : cc, i = sq(r, c), p = s.b[i];
        var cls = "sq " + ((r + c) % 2 ? "dk" : "lt");
        if (G.last && (G.last.from === i || G.last.to === i)) cls += " last";
        if (G.sel === i) cls += " sel";
        if (G.pre && (G.pre.from === i || G.pre.to === i)) cls += " pre";
        if (i === chkSq) cls += " chk";
        var tg = G.targets.filter(function (m) { return m.to === i; })[0];
        if (tg) cls += tg.cap ? " cap" : " tgt";
        var lab = "";
        if (cc === 0) lab += '<b class="rk">' + (8 - r) + "</b>";
        if (rr === 7) lab += '<b class="fl">' + FILES[c] + "</b>";
        html += '<button type="button" class="' + cls + '" data-i="' + i + '" aria-label="' + name(i) + (p ? ", " + p : "") + '">' + lab + (p ? '<span class="pc">' + pieceHTML(p) + "</span>" : "") + "</button>";
      }
    }
    boardEl.innerHTML = html;
  }
  function captured() {
    var have = { w: { p: 8, n: 2, b: 2, r: 2, q: 1 }, b: { p: 8, n: 2, b: 2, r: 2, q: 1 } }, i, p;
    for (i = 0; i < 64; i++) { p = G.s.b[i]; if (p && p[1] !== "k") have[p[0]][p[1]]--; }
    function row(col) {
      var out = "";
      "qrbnp".split("").forEach(function (t) { for (var k = 0; k < have[col][t]; k++) out += '<i class="cp">' + window.RoyalePieces.svg(t, col) + "</i>"; });
      return out;
    }
    capW.innerHTML = row("w") || '<span class="none">нет</span>';     // потеряны белыми
    capB.innerHTML = row("b") || '<span class="none">нет</span>';
  }
  function setStatus(txt, kind) { statusEl.textContent = txt; statusEl.setAttribute("data-k", kind || ""); }
  function ai() { return G.mode === "ai"; }
  function online() { return G.mode === "online"; }
  function humanTurn() {
    if (online()) return !!(NET && NET.started && NET.opp && !NET.end && G.s.t === NET.color);
    return !ai() || G.s.t === G.human;
  }

  function onlineWho(mine) {
    if (!NET) return G.netMsg || "Создайте комнату или введите код друга.";
    if (!NET.started) return NET.host ? "Ждём соперника. Код комнаты: " + NET.code + "." : "Входим в комнату…";
    if (!NET.opp) return "Соперник отключился. Ждём возвращения…";
    return (mine ? "Ваш ход." : "Ход соперника.") + (NET.dt ? " Соперник предлагает ничью." : NET.dm ? " Ждём ответа на ничью." : "");
  }
  function refresh() {
    G.moves = legal(G.s, true);
    var s = G.s, chk = inCheck(s, s.t), mine = humanTurn(), on = online();
    if (!ai() && !on && G.autoFlip) G.flip = s.t === "b";
    drawBoard(); captured();
    var reps = G.reps[key(s)] || 0;
    if (on && NET && NET.end) {
      G.over = true;
      setStatus(NET.end.w === null ? "Ничья по соглашению." : NET.end.w === NET.color ? "Соперник сдался. Вы победили." : "Вы сдались. Победил соперник.", "end");
    } else if (!G.moves.length) {
      G.over = true;
      if (!chk) setStatus("Пат. Ничья.", "end");
      else if (on) setStatus("Мат. " + (NET && s.t === NET.color ? "Победил соперник" : "Вы победили") + ".", "end");
      else if (ai()) setStatus("Мат. " + (s.t === G.human ? "Победил компьютер" : "Вы победили") + ".", "end");
      else setStatus("Мат. Победили " + colName(other(s.t)) + ".", "end");
    } else if (insufficient(s.b)) { G.over = true; setStatus("Ничья: не хватает фигур для мата.", "end"); }
    else if (s.hm >= 100) { G.over = true; setStatus("Ничья по правилу 50 ходов.", "end"); }
    else if (reps >= 3) { G.over = true; setStatus("Ничья: позиция повторилась трижды.", "end"); }
    else {
      G.over = false;
      var who = on ? onlineWho(mine) : (ai() ? (mine ? "Ваш ход." : "Компьютер думает…") : "Ход " + (s.t === "w" ? "белых" : "чёрных") + ".");
      setStatus((chk ? "Шах! " : "") + who, chk ? "check" : "");
    }
    if (on && G.over && NET && NET.started && NET.opp) {
      if (NET.rt && !NET.rm) statusEl.textContent += " Соперник предлагает реванш.";
      else if (NET.rm && !NET.rt) statusEl.textContent += " Ждём ответа на реванш.";
    }
    $("pgn").disabled = !G.hist.length;
    $("undo").hidden = on;
    $("undo").disabled = G.hist.length === 0 || G.thinking;
    netUI();
    if (G.pre) { if (G.over) G.pre = null; else if (mine) runPremove(); else refreshStatusHint(); }
    if (!G.over && !mine && ai()) think();
  }

  function pushMove(m) {
    var moves = legal(G.s, true), text = san(G.s, m, moves);
    G.hist.push({ s: G.s, m: m, san: text, last: G.last });
    G.s = apply(G.s, m); G.last = { from: m.from, to: m.to };
    var k = key(G.s); G.reps[k] = (G.reps[k] || 0) + 1;
  }
  function commit(m) {
    pushMove(m);
    G.sel = -1; G.targets = [];
    if (online() && NET) NET.dt = false;
    if (online() && NET) netSend({ k: "mv", f: m.from, t: m.to, p: m.promo || "", n: G.hist.length });
    refresh();
  }
  function think() {
    if (G.thinking) return;
    G.thinking = true; $("undo").disabled = true;
    var tk = G.token;
    setTimeout(function () {
      if (tk !== G.token) return;                              // игру закрыли или начали заново
      var m = pickMove(G.s, G.level);
      G.thinking = false;
      if (m && !G.over) commit(m);
    }, 280);
  }

  /* ---------- премув: пока ход соперника, можно заранее выбрать свой ответ; он сыграется сам, если станет возможным ---------- */
  function myColor() {
    if (ai()) return G.human;
    if (online() && NET && NET.started && NET.opp && !NET.end) return NET.color;
    return null;
  }
  function canPremove() { var c = myColor(); return !!c && !G.over && G.s.t !== c; }
  function preMoves(i) {                                      // ходы фигуры так, как будто очередь за нами (без проверки шаха)
    var st = copy(G.s); st.t = myColor(); st.ep = -1;
    return gen(st, true).filter(function (m) { return m.from === i; });
  }
  function clearPre() {
    var had = G.pre || G.sel >= 0 || G.pending;
    G.pre = null; G.sel = -1; G.targets = []; G.pending = null; G.pendingPre = false;
    if (promoEl) promoEl.hidden = true;
    return !!had;
  }
  function setPremove(m) {
    G.pre = { from: m.from, to: m.to, promo: m.promo || "" };
    G.sel = -1; G.targets = []; G.pendingPre = false;
    drawBoard(); refreshStatusHint();
  }
  function onPremoveSquare(i) {
    var p = G.s.b[i], tg = G.targets.filter(function (m) { return m.to === i; });
    if (G.sel >= 0 && tg.length) {
      if (tg[0].promo) { G.pendingPre = true; askPromo(tg); return; }
      setPremove(tg[0]); return;
    }
    if (p && p[0] === myColor()) { G.sel = i; G.targets = preMoves(i); }
    else { G.pre = null; G.sel = -1; G.targets = []; }        // клик мимо снимает премув
    drawBoard(); refreshStatusHint();
  }
  function refreshStatusHint() {
    if (!statusEl || G.over || humanTurn()) return;
    var base = statusEl.textContent.replace(/ Запланирован ход .*$/, "");
    statusEl.textContent = base + (G.pre ? " Запланирован ход " + name(G.pre.from) + "–" + name(G.pre.to) + "." : "");
  }
  function runPremove() {                                     // вызывается из refresh(): наша очередь, пробуем сыграть запланированное
    var pm = G.pre; if (!pm) return;
    if (G.over) { G.pre = null; return; }
    if (!humanTurn()) return;
    G.pre = null;
    var m = G.moves.filter(function (x) { return x.from === pm.from && x.to === pm.to && (x.promo || "") === pm.promo; })[0];
    if (!m) { drawBoard(); return; }                          // стало нелегальным (фигуру съели, шах и т.п.): молча отменяем
    var n = G.hist.length, tk = G.token;
    setTimeout(function () { if (tk === G.token && n === G.hist.length && humanTurn() && !G.over) commit(m); }, 110);
  }

  function onSquare(i) {
    if (G.over || G.pending) return;
    if (canPremove()) { onPremoveSquare(i); return; }
    if (G.thinking || !humanTurn()) return;
    var p = G.s.b[i], tg = G.targets.filter(function (m) { return m.to === i; });
    if (G.sel >= 0 && tg.length) {
      if (tg[0].promo) { askPromo(tg); return; }
      commit(tg[0]); return;
    }
    if (p && p[0] === G.s.t) {
      G.sel = i; G.targets = G.moves.filter(function (m) { return m.from === i; });
    } else { G.sel = -1; G.targets = []; }
    drawBoard();
  }
  function askPromo(tg) {
    G.pending = tg;
    var col = G.pendingPre ? myColor() : G.s.t;
    promoEl.innerHTML = '<p>Превратить пешку в…</p><div>' + ["q", "r", "b", "n"].map(function (t) { return '<button type="button" data-p="' + t + '" aria-label="' + RU[t] + '">' + window.RoyalePieces.svg(t, col) + "</button>"; }).join("") + "</div>";
    promoEl.hidden = false;
  }

  function newGame() {
    G.token++; G.pre = null; G.pendingPre = false;
    G.s = start(); G.hist = []; G.last = null; G.sel = -1; G.targets = []; G.over = false; G.thinking = false; G.pending = null;
    G.reps = {}; G.reps[key(G.s)] = 1; promoEl.hidden = true;
    G.flip = ai() ? G.human === "b" : false;
    refresh();
  }
  function undo() {
    if (G.thinking || !G.hist.length) return;
    do {                                                       // против компьютера откатываем свой ход и ответ
      var h = G.hist.pop(), k = key(G.s);
      G.reps[k] = Math.max(0, (G.reps[k] || 1) - 1);
      G.s = h.s; G.last = h.last;
    } while (ai() && G.hist.length && G.s.t !== G.human);
    G.sel = -1; G.targets = []; G.pending = null; G.pre = null; G.pendingPre = false; promoEl.hidden = true;
    refresh();
  }
  function setMode(v) {
    var nm = v === "pvp" ? "pvp" : v === "online" ? "online" : "ai";
    if (nm === "online" && G.mode === "online" && NET) return;       // повторный клик по «По коду» не рвёт комнату
    leaveRoom();
    G.mode = nm; G.netMsg = "";
    var seg = $("segMode");
    Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-v") === G.mode ? "true" : "false"); });
    newGame();                                                 // refresh() сам покажет нужные блоки панели
  }
  function seg(id, cb) {
    var el = $(id);
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      Array.prototype.forEach.call(el.children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      cb(b.getAttribute("data-v"));
    });
  }
  function bind() {
    boardEl.addEventListener("contextmenu", function (e) { e.preventDefault(); if (clearPre()) { drawBoard(); refreshStatusHint(); } });   // правая кнопка снимает премув
    boardEl.addEventListener("click", function (e) { var b = e.target.closest(".sq"); if (b) onSquare(+b.getAttribute("data-i")); });
    promoEl.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-p]"); if (!b || !G.pending) return;
      var m = G.pending.filter(function (x) { return x.promo === b.getAttribute("data-p"); })[0];
      G.pending = null; promoEl.hidden = true;
      if (m) { if (G.pendingPre) setPremove(m); else commit(m); } else G.pendingPre = false;
    });
    seg("segMode", setMode);
    seg("segSide", function (v) { G.human = v === "b" ? "b" : "w"; if (ai()) newGame(); });
    seg("segLevel", function (v) { G.level = +v; });
    seg("segTurn", function (v) { G.autoFlip = v === "1"; if (!G.autoFlip) G.flip = false; refresh(); });
    $("newGame").addEventListener("click", function () { if (online()) rematch(); else newGame(); });
    bindNet();
    $("undo").addEventListener("click", undo);
    $("pgn").addEventListener("click", function (e) { if (G.hist.length) copyText(pgn(), e.currentTarget); });
    $("flip").addEventListener("click", function () { G.flip = !G.flip; drawBoard(); });
    $("cgClose").addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || root.hidden) return;
      if (G.sel >= 0 || G.pending || G.pre) { clearPre(); drawBoard(); refreshStatusHint(); }
      else close();
    });
  }

  /* ---------- онлайн по коду комнаты ----------
     Транспорт: Supabase Realtime (канал chess:КОД, broadcast + presence). Таблицы и ключи не нужны: используется тот же
     supabase из js/data.js. Хозяин комнаты (создатель) главный: при входе гостя шлёт ему всю партию (sync), гость ходит
     через broadcast. Каждый ход проверяется у получателя по правилам, поэтому подложить нелегальный ход нельзя. */
  var CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;
  function client() {
    if (RT) return RT;
    var c = (window.PIPIT && window.PIPIT.supabase) || {};
    if (!c.url || !c.anonKey || !window.supabase) return null;
    try {
      RT = window.supabase.createClient(c.url, c.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "royale-chess-rt" }, realtime: { params: { eventsPerSecond: 10 } } });
    } catch (e) { RT = null; }
    return RT;
  }
  function rnd(n) {
    var A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", out = "", i, v = new Uint32Array(n);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(v); else for (i = 0; i < n; i++) v[i] = Math.floor(Math.random() * 4294967296);
    for (i = 0; i < n; i++) out += A[v[i] % A.length];
    return out;
  }
  function tabId() {                                           // один id на вкладку: после перезагрузки гость занимает своё прежнее место
    try { var v = sessionStorage.getItem("royale-chess-id"); if (!v) { v = rnd(10); sessionStorage.setItem("royale-chess-id", v); } return v; } catch (e) { return rnd(10); }
  }
  function mkNet(code, host) {
    return { code: code, host: host, id: tabId(), ch: null, color: null, opp: false, started: false, synced: false, gid: null, hid: null, told: {}, queue: [], dm: false, dt: false, rm: false, rt: false, end: null, sawHost: false, subbed: false };
  }
  function parseCode(raw) {
    var t = String(raw || ""), m = /room=([A-Za-z0-9]{5})/.exec(t);
    t = (m ? m[1] : t.replace(/[^A-Za-z0-9]/g, "")).toUpperCase();
    return CODE_RE.test(t) ? t : "";
  }
  function netSend(obj) {
    if (!NET || !NET.ch) return;
    obj.from = NET.id;
    try { var r = NET.ch.send({ type: "broadcast", event: "m", payload: obj }); if (r && r.catch) r.catch(function () {}); } catch (e) { /* сеть моргнула: гость запросит sync */ }
  }
  function serialize() { return G.hist.map(function (h) { return [h.m.from, h.m.to, h.m.promo || ""]; }); }
  function rebuild(list) {
    G.s = start(); G.hist = []; G.last = null; G.reps = {}; G.reps[key(G.s)] = 1;
    G.sel = -1; G.targets = []; G.pending = null; G.pendingPre = false; G.pre = null; G.thinking = false; G.over = false; G.token++;
    if (promoEl) promoEl.hidden = true;
    for (var i = 0; i < list.length; i++) {
      var x = list[i], m = legal(G.s, true).filter(function (o) { return o.from === x[0] && o.to === x[1] && (o.promo || "") === (x[2] || ""); })[0];
      if (!m) return false;
      pushMove(m);
    }
    return true;
  }
  function leaveRoom() {
    var me = NET; NET = null;
    if (!me || !me.ch) return;
    try { me.ch.untrack(); } catch (e) { /* уже отключён */ }
    try { if (RT) RT.removeChannel(me.ch); else me.ch.unsubscribe(); } catch (e) { /* уже отключён */ }
  }
  function netFail(msg) {
    leaveRoom(); G.netMsg = msg; rebuild([]); G.flip = false; refresh();
  }
  function connect(me) {
    var cl = client();
    if (!cl) { netFail("Онлайн недоступен: не подключён Supabase (js/data.js)."); return; }
    var ch = cl.channel("chess:" + me.code, { config: { broadcast: { self: false, ack: false }, presence: { key: me.id } } });
    me.ch = ch;
    ch.on("broadcast", { event: "m" }, function (m) { if (NET === me) onNet(me, (m && m.payload) || {}); });
    ch.on("presence", { event: "sync" }, function () { if (NET === me) onPresence(me); });
    ch.subscribe(function (status) {
      if (NET !== me) return;
      if (status === "SUBSCRIBED") {
        me.subbed = true;
        ch.track({ host: me.host });                          // после переподключения встаём в комнату заново
        if (!me.host) setTimeout(function () { if (NET === me && !me.sawHost) netFail("Комната не найдена. Проверьте код."); }, 4500);
      } else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !me.subbed) netFail("Нет связи с сервером. Попробуйте ещё раз.");
    });
  }
  function createRoom() {
    leaveRoom(); G.netMsg = "";
    NET = mkNet(rnd(5), true); NET.color = G.human; NET.synced = true;
    rebuild([]); G.flip = NET.color === "b";
    connect(NET); refresh();
  }
  function joinRoom(raw) {
    var code = parseCode(raw);
    if (!code) { G.netMsg = "Код состоит из 5 символов: буквы и цифры."; if (!NET) refresh(); return; }
    leaveRoom(); G.netMsg = "";
    NET = mkNet(code, false);
    rebuild([]); G.flip = false;
    connect(NET); refresh();
  }
  function hostSync(fresh) {
    var me = NET; if (!me || !me.host) return;
    me.started = true;
    netSend({ k: "sync", hc: me.color, gid: me.gid, mv: serialize(), en: me.end ? (me.end.w || "d") : null, nw: fresh ? 1 : 0 });
    refresh();
  }
  function onPresence(me) {
    onPresence0(me);
    if (NET !== me) return;
    var q = me.queue; me.queue = [];                          // сообщения, пришедшие раньше, чем мы увидели соперника в комнате
    q.forEach(function (p) { if (NET === me) onNet(me, p); });
  }
  function onPresence0(me) {
    var st = me.ch.presenceState(), others = [];
    Object.keys(st).forEach(function (k) { if (k !== me.id) others.push({ id: k, host: !!(st[k][0] && st[k][0].host) }); });
    others.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    if (me.host) {
      if (others.some(function (o) { return o.host && o.id < me.id; })) { netFail("Этот код уже занят. Создайте комнату ещё раз."); return; }
      var guests = others.filter(function (o) { return !o.host; }), cur = guests.filter(function (o) { return o.id === me.gid; })[0] || guests[0];
      guests.forEach(function (o) { if (cur && o.id !== cur.id && !me.told[o.id]) { me.told[o.id] = 1; netSend({ k: "full", to: o.id }); } });
      me.opp = !!cur;
      if (cur && cur.id !== me.gid) { me.gid = cur.id; hostSync(); return; }   // вошёл гость (или вернулся): отдаём ему партию
      if (!cur) me.gid = null;
    } else {
      var hosts = others.filter(function (o) { return o.host; });
      if (hosts.length > 1) { netFail("Комната недоступна."); return; }
      me.opp = hosts.length === 1; me.hid = hosts.length ? hosts[0].id : null;
      if (me.opp) me.sawHost = true;
      if (me.opp && !me.asked) { me.asked = true; netSend({ k: "need" }); }   // при входе всегда просим у хозяина актуальную партию
    }
    refresh();
  }
  function onNet(me, p) {
    var exp = me.host ? me.gid : me.hid;
    if (!exp) { if (me.queue.length < 20) me.queue.push(p); return; }
    if (p.from !== exp) return;                                    // слушаем только соперника
    var live = me.started && !me.end;
    if (p.k === "sync") {
      if (me.host) return;
      if (p.gid && p.gid !== me.id) { netFail("Комната занята: там уже двое."); return; }
      me.color = other(p.hc); me.started = true; me.sawHost = true;
      if (p.nw) { me.rm = false; me.rt = false; me.dm = false; me.dt = false; }
      me.end = p.en ? { w: p.en === "d" ? null : p.en } : null;
      if (!rebuild(p.mv || [])) { netSend({ k: "need" }); return; }
      if (!me.synced || p.nw) G.flip = me.color === "b";
      me.synced = true;
      refresh();
    } else if (p.k === "full") {
      if (!me.host && p.to === me.id) netFail("Комната занята: там уже двое.");
    } else if (p.k === "need") {
      if (me.host) hostSync();
    } else if (p.k === "mv") {
      if (!live) return;
      var m = (p.n === G.hist.length + 1 && G.s.t !== me.color) ? legal(G.s, true).filter(function (o) { return o.from === p.f && o.to === p.t && (o.promo || "") === (p.p || ""); })[0] : null;
      if (!m) { if (me.host) hostSync(); else netSend({ k: "need" }); return; }   // рассинхрон: главный присылает партию заново
      pushMove(m); G.sel = -1; G.targets = []; G.pending = null; if (promoEl) promoEl.hidden = true;
      me.dm = false;                                           // ход соперника = отказ от нашего предложения ничьей
      refresh(); notify();
    } else if (p.k === "resign") {
      if (!live || G.over) return;
      me.end = { w: me.color }; refresh();
    } else if (p.k === "dr") {
      if (!live || G.over) return;
      me.dt = true;
      if (me.dm) { me.end = { w: null }; me.dm = me.dt = false; }  // предложили одновременно: ничья
      refresh(); notify();
    } else if (p.k === "da") {
      if (!live || G.over || !me.dm) return;
      me.end = { w: null }; me.dm = me.dt = false; refresh();
    } else if (p.k === "rm") {
      me.rt = true;
      if (me.rm && me.host) doRematch(); else refresh();
    }
  }
  function rematch() {
    var me = NET;
    if (!me || !me.started || !me.opp || !G.over || me.rm) return;
    me.rm = true; netSend({ k: "rm" });
    if (me.rt && me.host) doRematch(); else refresh();
  }
  function doRematch() {
    var me = NET; if (!me || !me.host) return;
    me.color = other(me.color); me.end = null; me.rm = false; me.rt = false; me.dm = false; me.dt = false;
    rebuild([]); G.flip = me.color === "b";
    hostSync(true);
  }
  function draw() {
    var me = NET;
    if (!me || !me.started || !me.opp || G.over) return;
    if (me.dt) { me.end = { w: null }; me.dt = false; netSend({ k: "da" }); }   // принимаем предложение соперника
    else if (!me.dm) { me.dm = true; netSend({ k: "dr" }); }
    refresh();
  }
  /* звук и мигание заголовка вкладки, когда ход соперника пришёл, а вы смотрите не на доску */
  var baseTitle = document.title, flashT = 0, actx = null;
  function stopFlash() { if (flashT) { clearInterval(flashT); flashT = 0; document.title = baseTitle; } }
  function notify() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        actx = actx || new AC(); if (actx.resume) actx.resume();
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = "square"; o.frequency.value = 660; g.gain.value = 0.03; o.connect(g); g.connect(actx.destination);
        o.start(); o.stop(actx.currentTime + 0.09);
      }
    } catch (e) { /* без звука */ }
    if (document.hidden || (root && root.hidden)) {
      stopFlash(); var on = false;
      flashT = setInterval(function () { on = !on; document.title = on ? "♟ Ваш ход" : baseTitle; }, 900);
    }
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && root && !root.hidden) stopFlash(); });
  function resultStr() {
    if (!G.over) return "*";
    if (online() && NET && NET.end) return NET.end.w === "w" ? "1-0" : NET.end.w === "b" ? "0-1" : "1/2-1/2";
    if (!G.moves.length && inCheck(G.s, G.s.t)) return G.s.t === "w" ? "0-1" : "1-0";
    return "1/2-1/2";
  }
  function pgn() {
    var EN = { "Кр": "K", "Ф": "Q", "Л": "R", "С": "B", "К": "N" }, out = [], i, t, d = new Date();
    for (i = 0; i < G.hist.length; i++) {
      t = G.hist[i].san.replace(/^(Кр|Ф|Л|С|К)/, function (m) { return EN[m]; }).replace(/=(Ф|Л|С|К)/, function (m, x) { return "=" + EN[x]; });
      out.push((i % 2 ? "" : (i / 2 + 1) + ". ") + t);
    }
    var r = resultStr();
    return '[Event "Royale"]\n[Site "Royale Almaty"]\n[Date "' + d.getFullYear() + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + ("0" + d.getDate()).slice(-2) + '"]\n[Result "' + r + '"]\n\n' + out.join(" ") + " " + r + "\n";
  }
  function resign() {
    var me = NET;
    if (!me || !me.started || !me.opp || G.over) return;
    if (!window.confirm("Сдаться?")) return;
    me.end = { w: other(me.color) }; netSend({ k: "resign" }); refresh();
  }
  function netLink() { return location.origin + location.pathname + "?room=" + NET.code; }
  function copyText(t, btn) {
    var old = btn ? btn.textContent : "";
    function ok() { if (btn) { btn.textContent = "Скопировано"; setTimeout(function () { btn.textContent = old; }, 1400); } }
    function ask() { window.prompt("Скопируйте:", t); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, ask); else ask();
  }
  function netUI() {
    if (!root) return;
    var on = online();
    $("rowSide").hidden = !(ai() || (on && !NET));
    $("rowLevel").hidden = !ai();
    $("rowTurn").hidden = G.mode !== "pvp";
    $("rowNet").hidden = !on;
    $("newGame").textContent = on ? "Реванш" : "Новая игра";
    if (!on) { $("newGame").disabled = false; return; }
    $("netLobby").hidden = !!NET; $("netRoom").hidden = !NET;
    $("newGame").disabled = !(NET && NET.started && NET.opp && G.over && !NET.rm);
    if (NET) {
      $("netCodeShow").textContent = NET.code;
      $("netWho").textContent = (NET.color ? "Вы играете " + (NET.color === "w" ? "белыми" : "чёрными") + ". " : "") + (NET.opp ? "Соперник в комнате." : "Соперника нет в комнате.");
      $("netResign").disabled = !(NET.started && NET.opp && !G.over);
      $("netDraw").textContent = NET.dt ? "Принять ничью" : "Предложить ничью";
      $("netDraw").disabled = !(NET.started && NET.opp && !G.over) || (NET.dm && !NET.dt);
    }
  }
  function bindNet() {
    var inp = $("netCode");
    $("netCreate").addEventListener("click", createRoom);
    $("netJoin").addEventListener("click", function () { joinRoom(inp.value); });
    inp.addEventListener("input", function () { if (!/room=/i.test(inp.value)) inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") joinRoom(inp.value); });
    $("netCopyLink").addEventListener("click", function (e) { if (NET) copyText(netLink(), e.currentTarget); });
    $("netCodeShow").addEventListener("click", function (e) { if (NET) copyText(NET.code, null); });
    $("netResign").addEventListener("click", resign);
    $("netDraw").addEventListener("click", draw);
    $("netLeave").addEventListener("click", function () { leaveRoom(); G.netMsg = ""; rebuild([]); G.flip = false; refresh(); });
  }

  /* ---------- открыть / закрыть ---------- */
  function open(from) {
    if (!root && !build()) return;
    if (!root.hidden) return;
    opener = from || document.activeElement;
    root.hidden = false;
    document.querySelector(".stage").classList.add("chess-on");
    document.dispatchEvent(new CustomEvent("royale-chess", { detail: { open: true } }));
    if (!G.s) setMode("ai"); else refresh();                   // партия сохраняется, пока страница открыта
    stopFlash();
    var x = $("cgClose"); if (x) x.focus();
  }
  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    document.querySelector(".stage").classList.remove("chess-on");
    document.dispatchEvent(new CustomEvent("royale-chess", { detail: { open: false } }));
    if (opener && opener.focus) opener.focus();
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-chess]");
    if (b) { e.preventDefault(); open(b); }
  });
  (function () {                                               // ссылка вида ?room=КОД открывает шахматы и входит в комнату
    var m = /[?&]room=([A-Za-z0-9]{5})(?:&|$)/.exec(location.search);
    if (!m) return;
    setTimeout(function () { open(); if (root) { setMode("online"); joinRoom(m[1]); } }, 600);
  })();
  window.RoyaleChess = { open: open, close: close, start: start, legal: legal, apply: apply, pickMove: pickMove, copy: copy, evaluate: evaluate };
})();
