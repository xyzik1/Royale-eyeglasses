/* Pipit shop: логика страницы. Данные товаров лежат в js/data.js */
(function () {
  "use strict";

  var CFG = window.PIPIT;
  var ALL = CFG.products;
  var CAT = document.body.getAttribute("data-cat") || "glasses";
  var PRODUCTS = ALL.filter(function (p) { return (p.cat || "glasses") === CAT; });

  var BIRD = ["...XXXX.....", "..XXXXXXX...", "..XXX.XXXXX.", "..XXXXXXX...", ".XXXXXXXX...", "XXXXXXXXX...", ".XXXXXXX....", "..XXXXX.....", "...X..X.....", "..XX..XX...."];
  function birdRects(fill) {
    var out = "";
    BIRD.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) {
        if (row[x] === "X") out += '<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02" fill="' + fill + '"/>';
      }
    });
    return out;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function money(n) { return n + " " + CFG.currency; }
  function $(id) { return document.getElementById(id); }

  $("logo").innerHTML = birdRects("#1b1c1d");
  $("dockBird").innerHTML = birdRects("#1b1c1d");
  if ($("dockChess") && window.RoyalePieces) $("dockChess").innerHTML = window.RoyalePieces.svg("n", "b");   // конь на иконке кнопки «Шахматы» в доке
  $("year").textContent = new Date().getFullYear();

  var state = { sel: PRODUCTS.length ? PRODUCTS[0].id : null, mode: "3d", bag: loadBag() };
  /* корзина общая для «Очков» и «Шапок»: хранится в браузере, чтобы пережить переход */
  var BAG_KEY = "royale-bag";
  function loadBag() {
    var out = {};
    try {
      var b = JSON.parse(localStorage.getItem(BAG_KEY) || "{}");
      for (var k in b) if (byId(k) && b[k] > 0) out[k] = b[k];
    } catch (e) { /* пустая корзина */ }
    return out;
  }
  function saveBag() { try { localStorage.setItem(BAG_KEY, JSON.stringify(state.bag)); } catch (e) { /* без записи */ } }
  var grid = $("grid"), hero = $("hero"), toastEl = $("toast"), toastTimer;
  var wins = {};

  function byId(id) { return ALL.filter(function (p) { return p.id === id; })[0]; }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("on"); }, 2200);
  }

  /* ---------- товары ---------- */
  function productImg(p, cls) {
    var src = p.image || p.thumb;
    return src ? '<img src="' + esc(src) + '" alt="' + esc(p.name) + '"' + (cls ? ' class="' + cls + '"' : "") + '>' : "";
  }

  function renderGrid() {
    var html = "";
    PRODUCTS.forEach(function (p) {
      html += '<article class="card' + (p.id === state.sel ? " sel" : "") + '">' +
        '<button class="pic" type="button" data-pick="' + esc(p.id) + '" aria-label="Показать: ' + esc(p.name) + '">' + (productImg(p) || '<span class="ph"></span>') + '</button>' +
        '<div class="meta"><span>' + esc(p.name) + '</span>' + (p.model ? '<span class="ar">В <b>AR</b></span>' : "<span></span>") + '<span>' + money(p.price) + '</span></div>' +
        '<button class="add" type="button" data-add="' + esc(p.id) + '"' + (p.stock ? "" : " disabled") + '>' + (p.stock ? "В корзину" : "Нет в наличии") + '</button></article>';
    });
    for (var i = PRODUCTS.length; i < Math.max(CFG.slots, PRODUCTS.length); i++) {
      html += '<article class="card empty" aria-hidden="true"></article>';
    }
    grid.innerHTML = html;
  }

  /* ---------- 3D и AR на сцене (js/tryon.js грузится лениво) ---------- */
  var live = null, liveToken = 0, tryonMod = null;
  function loadTryon() {
    if (!tryonMod) tryonMod = import("./tryon.js").catch(function (e) { tryonMod = null; throw e; });
    return tryonMod;
  }
  function stopLive() {
    liveToken++;
    if (live) { live.dispose(); live = null; }
    hero.classList.remove("live");
  }
  function mountLive(p) {
    var token = ++liveToken;
    hero.classList.add("live");
    hero.innerHTML = '<div class="live-msg" id="liveMsg">Загружаю…</div>';
    var msg = $("liveMsg");
    function status(t) { msg.textContent = t; }
    loadTryon().then(function (m) {
      if (token !== liveToken) return;
      if (state.mode === "ar") {
        live = m.mountTryOn(hero, p, { onStatus: status });
        live.ready.catch(function (err) {
          if (token !== liveToken) return;
          toast((err && err.userMessage) || "Не удалось включить камеру");
          setMode("3d");
        });
      } else {
        live = m.mountViewer(hero, p, { onStatus: status });
        live.ready.catch(function () { if (token === liveToken) status("Не удалось загрузить 3D-модель"); });
      }
    }).catch(function () {
      if (token === liveToken) status("Не удалось загрузить 3D. Откройте сайт через http://localhost или https");
    });
  }

  function renderStage() {
    stopLive();
    var p = state.sel ? byId(state.sel) : null;
    var buy = $("buy"), pill = $("pill"), tryAr = $("tryAr");
    if (!p) {
      hero.innerHTML = '<div class="empty-state"><svg viewBox="0 -1 12 12" shape-rendering="crispEdges" aria-hidden="true">' + birdRects("#1b1c1d") + '</svg>' +
        '<h2>Здесь пока пусто</h2><p>Скоро появится первый товар. Загляните позже.</p></div>';
      $("iName").textContent = "Скоро";
      $("iPrice").textContent = "— " + CFG.currency;
      buy.disabled = true; buy.textContent = "Скоро в продаже";
      pill.disabled = true; $("pillTxt").textContent = "Купить";
      tryAr.disabled = true;
      $("specs").innerHTML = "";
      return;
    }
    if (p.model) mountLive(p);
    else hero.innerHTML = p.image ? productImg(p) : '<div class="empty-state"><h2>' + esc(p.name) + '</h2><p>Фото скоро будет.</p></div>';
    $("iName").textContent = p.name;
    $("iPrice").textContent = money(p.price);
    buy.disabled = !p.stock; buy.textContent = p.stock ? "В корзину" : "Нет в наличии";
    pill.disabled = !p.stock; $("pillTxt").textContent = "Купить (" + money(p.price) + ")";
    tryAr.disabled = !p.model;
    $("specs").innerHTML = (p.specs || []).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
  }

  function select(id) { state.sel = id; renderGrid(); renderStage(); }

  /* переключение товаров стрелками на сцене и клавишами ← → */
  var prevBtn = $("prevP"), nextBtn = $("nextP");
  function step(dir) {
    if (PRODUCTS.length < 2) return;
    var i = 0;
    PRODUCTS.forEach(function (p, k) { if (p.id === state.sel) i = k; });
    select(PRODUCTS[(i + dir + PRODUCTS.length) % PRODUCTS.length].id);
  }
  prevBtn.hidden = nextBtn.hidden = PRODUCTS.length < 2;
  prevBtn.addEventListener("click", function () { step(-1); });
  nextBtn.addEventListener("click", function () { step(1); });
  document.addEventListener("keydown", function (e) {
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });

  /* ---------- корзина ---------- */
  function bagCount() { var n = 0; for (var k in state.bag) n += state.bag[k]; return n; }
  function bagSubtotal() {
    var t = 0;
    for (var k in state.bag) { var p = byId(k); if (p) t += p.price * state.bag[k]; }
    return t;
  }
  function updateBagUI() {
    saveBag();
    var n = bagCount();
    $("bagTopTxt").textContent = "Корзина (" + n + ")";
    var dn = $("dockN"); dn.textContent = n; dn.hidden = n === 0;
    if (wins.bag) renderBag();
  }
  function addToCart(id) {
    var p = byId(id); if (!p) return;
    if (!p.stock) { toast(p.name + ": нет в наличии"); return; }
    state.bag[id] = (state.bag[id] || 0) + 1;
    updateBagUI();
    toast(p.name + " добавлено в корзину");
  }

  grid.addEventListener("click", function (e) {
    var pk = e.target.closest("[data-pick]"); if (pk) { select(pk.getAttribute("data-pick")); return; }
    var ad = e.target.closest("[data-add]"); if (ad) addToCart(ad.getAttribute("data-add"));
  });
  $("buy").addEventListener("click", function () { if (state.sel) addToCart(state.sel); });
  $("pill").addEventListener("click", function () { if (state.sel) addToCart(state.sel); });

  var m3d = $("m3d"), mar = $("mar");
  function setMode(m) {
    var p = state.sel ? byId(state.sel) : null;
    if (m === "ar" && !(p && p.model)) { toast("Для этого товара пока нет AR-примерки"); return; }
    if (state.mode === m) return;
    state.mode = m;
    m3d.setAttribute("aria-pressed", m === "3d");
    mar.setAttribute("aria-pressed", m === "ar");
    renderStage();
  }
  /* шахматы открываются поверх сцены: камеру AR на это время выключаем */
  document.addEventListener("royale-chess", function (e) { if (e.detail && e.detail.open && state.mode === "ar") setMode("3d"); });
  m3d.addEventListener("click", function () { setMode("3d"); });
  mar.addEventListener("click", function () { setMode("ar"); });
  $("tryAr").addEventListener("click", function () { setMode("ar"); });

  /* ---------- окна ---------- */
  var layer = $("layer"), z = 1;
  var defs = {
    why: { title: "Почему Royale?", w: 420, x: 12, y: 80, build: buildWhy },
    about: { title: "О нас", w: 480, x: 200, y: 110, build: buildAbout },
    ship: { title: "Доставляем по всему миру", w: 430, x: 420, y: 90, alt: true, build: buildShip },
    bag: { title: "Ваша корзина", w: 400, x: 520, y: 70, build: buildBag },
    acc: { title: "Аккаунт", w: 400, x: 520, y: 70, build: buildAcc },
    req: { title: "Оставить заявку", w: 420, x: 480, y: 70, build: buildReq },
    clock: { title: "Время и погода", w: 380, x: 12, y: 56, build: buildClock },
    arcade: { title: "Royale Arcade", w: 340, x: 330, y: 70, cls: "arcade", build: buildArcade }
  };

  function openWin(id) {
    if (wins[id]) { closeWin(id); return; }
    var d = defs[id], el = document.createElement("section");
    el.className = "win" + (d.alt ? " alt" : "") + (d.cls ? " " + d.cls : "");
    el.style.width = d.w + "px";
    el.style.left = Math.max(8, Math.min(d.x, innerWidth - d.w - 8)) + "px";
    el.style.top = d.y + "px";
    el.style.zIndex = ++z;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", d.title);
    el.innerHTML = '<div class="tb"><div class="tt"><span>' + d.title + '</span></div><button class="x" type="button" aria-label="Закрыть окно: ' + d.title + '">×</button></div><div class="body"></div>';
    layer.appendChild(el);
    wins[id] = { el: el, body: el.querySelector(".body") };
    d.build(wins[id].body);
    el.addEventListener("pointerdown", function () { el.style.zIndex = ++z; });
    el.querySelector(".x").addEventListener("click", function () { closeWin(id); });
    dragWin(el, el.querySelector(".tb"));
    setExpanded(id, true);
  }
  function closeWin(id) {
    var w = wins[id]; if (!w) return;
    if (w.timer) clearInterval(w.timer);
    if (w.dispose) w.dispose();
    w.el.remove();
    delete wins[id];
    setExpanded(id, false);
  }
  function setExpanded(id, on) {
    if (id === "clock") $("clockBtn").setAttribute("aria-expanded", on);
    if (id === "req") $("reqBtn").setAttribute("aria-expanded", on);
    if (id === "acc") $("accBtn").setAttribute("aria-expanded", on);
    var b = document.querySelector('[data-win="' + id + '"]');
    if (b) b.setAttribute("aria-expanded", on);
  }
  function dragWin(el, handle) {
    var sx, sy, ox, oy, on = false;
    handle.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".x")) return;
      on = true; sx = e.clientX; sy = e.clientY; ox = el.offsetLeft; oy = el.offsetTop;
      handle.setPointerCapture(e.pointerId);
      handle.style.cursor = "grabbing";
    });
    handle.addEventListener("pointermove", function (e) {
      if (!on) return;
      el.style.left = Math.max(0, Math.min(innerWidth - 60, ox + e.clientX - sx)) + "px";
      el.style.top = Math.max(0, Math.min(innerHeight - 40, oy + e.clientY - sy)) + "px";
    });
    function end() { on = false; handle.style.cursor = ""; }
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }
  document.querySelectorAll("[data-win]").forEach(function (b) {
    b.addEventListener("click", function () { openWin(b.getAttribute("data-win")); });
  });
  $("bagTop").addEventListener("click", function () { openWin("bag"); });
  $("clockBtn").addEventListener("click", function () { openWin("clock"); });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var top = null, tz = -1;
    for (var k in wins) { var zi = +wins[k].el.style.zIndex; if (zi > tz) { tz = zi; top = k; } }
    if (top) closeWin(top);
  });

  /* ---------- содержимое окон ---------- */
  function buildWhy(body) {
    var T = {
      idea: '<h2>Мало вещей, сделанных хорошо</h2><p class="sub">Подход Royale</p><p>Мы не гонимся за новинками каждую неделю. Каждая вещь проходит много примерок и доработок, и в продажу попадает только та, которую мы сами захотели бы носить.</p><p>Мы выбираем понятные материалы и честные швы. Так вещь служит дольше и выглядит лучше с возрастом.</p>',
      quality: '<h2>Из чего мы делаем</h2><p class="sub">Четыре правила</p><div class="facts"><div><b>Материалы</b>Берём проверенные ткани и пластики у небольших проверенных производителей.</div><div><b>Проверка</b>Каждая партия проходит ручную проверку в студии.</div><div><b>Ремонт</b>Детали заменяются, вещь не нужно выбрасывать.</div><div><b>Упаковка</b>Только переработанный картон, без лишнего пластика.</div></div>',
      care: '<h2>Забота о вещах</h2><p class="sub">Коротко</p><p>К каждой вещи прилагается карточка с правилами ухода. Чаще всего достаточно мягкой салфетки, тёплой воды и аккуратного хранения.</p><p>Если что-то пошло не так, напишите нам. Мы подскажем или поможем заменить деталь.</p>'
    };
    body.innerHTML = '<div class="tabs" role="tablist"><button role="tab" data-t="idea" aria-selected="true">Идея</button><button role="tab" data-t="quality" aria-selected="false">Качество</button><button role="tab" data-t="care" aria-selected="false">Уход</button></div><div id="whyTxt"></div>';
    var out = body.querySelector("#whyTxt");
    out.innerHTML = T.idea;
    body.querySelector(".tabs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-t]"); if (!b) return;
      body.querySelectorAll(".tabs button").forEach(function (x) { x.setAttribute("aria-selected", x === b); });
      out.innerHTML = T[b.getAttribute("data-t")];
    });
  }

  function buildAbout(body) {
    body.innerHTML = '<h2 class="big">Мы делаем вещи</h2>' +
      '<p class="lead">Из Алматы. Royale это маленькая студия, которая делает немного, но аккуратно.</p>' +
      '<p>Мы начали в 2024 году с простого вопроса: почему хорошие повседневные вещи так сложно найти? Мы нарисовали первые эскизы, сделали десятки прототипов и оставили только то, что нравилось нам самим.</p>' +
      '<p><b>Каждая вещь Royale:</b></p>' +
      '<div class="facts"><div><b>Продумана</b>Прототипы и примерки до выпуска.</div><div><b>Честная</b>Простые материалы и прозрачная цена.</div><div><b>Чинится</b>Запасные части и помощь по гарантии.</div></div>' +
      '<div class="note"><b>Сделано надолго</b>Гарантия два года. Если что-то сломается, напишите нам, и мы починим вещь или заменим её.</div>';
  }

  function buildShip(body) {
    body.innerHTML = '<h2>Стоимость доставки</h2><table class="ship"><tr><th></th><th>1 товар</th><th>2 товара</th><th>3+ товаров</th></tr>' +
      '<tr><th>Алматы</th><td class="free" colspan="3">Бесплатно</td></tr>' +
      '<tr><th>Казахстан</th><td>' + money(CFG.shippingEU) + '</td><td class="free" colspan="2">Бесплатно</td></tr>' +
      '<tr><th>Мир</th><td>12 ' + CFG.currency + '</td><td>12 ' + CFG.currency + '</td><td class="free">Бесплатно</td></tr></table>' +
      '<p>Заказы уходят из студии за 2–4 рабочих дня. Каждый заказ едет в коробке из переработанного картона. Ссылку для отслеживания пришлём на почту.</p>' +
      '<div class="note"><b>Международные заказы</b>Таможенные сборы и пошлины назначает страна получателя, платит их получатель. Заранее мы их рассчитать не можем.</div>';
  }

  /* ---------- заявки: пишем в таблицу requests в Supabase ---------- */
  var SB = CFG.supabase || {};
  var sb = null, user = null;

  /* Сессия Supabase хранится в куки (а не в localStorage): живёт год, общая для всех страниц сайта.
     Токен длиннее 4 КБ-лимита одной куки, поэтому режем на куски royale-auth.0, .1, ... */
  var CK = { size: 1800, days: 365 };
  function ckGet(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()\[\]\\\/+^]/g, "\\$&") + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function ckSet(name, val, days) {
    var a = "; path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
    document.cookie = name + "=" + encodeURIComponent(val) + "; max-age=" + Math.round(days * 86400) + a;
  }
  function ckDel(name) { document.cookie = name + "=; path=/; max-age=0; SameSite=Lax"; }
  var cookieStore = {
    getItem: function (k) {
      var n = +ckGet(k + ".n") || 0, s = "", i, p;
      if (!n) return null;
      for (i = 0; i < n; i++) { p = ckGet(k + "." + i); if (p == null) return null; s += p; }
      return s;
    },
    setItem: function (k, v) {
      var old = +ckGet(k + ".n") || 0, n = Math.ceil(v.length / CK.size), i;
      for (i = 0; i < n; i++) ckSet(k + "." + i, v.slice(i * CK.size, (i + 1) * CK.size), CK.days);
      for (i = n; i < old; i++) ckDel(k + "." + i);
      ckSet(k + ".n", String(n), CK.days);
    },
    removeItem: function (k) {
      var n = +ckGet(k + ".n") || 0, i;
      for (i = 0; i < n; i++) ckDel(k + "." + i);
      ckDel(k + ".n");
    }
  };
  if (SB.url && SB.anonKey && window.supabase) {
    try {
      sb = window.supabase.createClient(SB.url, SB.anonKey, { auth: { storage: cookieStore, storageKey: "royale-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    } catch (e) { sb = null; }
  }
  var COOLDOWN_KEY = "royale-req-last";
  function lastReq() { try { return +localStorage.getItem(COOLDOWN_KEY) || 0; } catch (e) { return 0; } }
  function markReq() { try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch (e) { /* без записи */ } }
  function bagItems() {
    return Object.keys(state.bag).filter(function (k) { return state.bag[k] > 0 && byId(k); }).map(function (k) {
      var p = byId(k); return { id: p.id, name: p.name, qty: state.bag[k], price: p.price };
    });
  }
  /* общие куски оформления окон «Заявка» и «Аккаунт» */
  var IC_USER = '<svg viewBox="0 0 44 44" fill="none" stroke="#1b1c1d" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true"><circle cx="22" cy="15" r="7" fill="#e4e4e2"/><path d="M8 38c0-8 6-13 14-13s14 5 14 13z" fill="#e4e4e2"/></svg>';
  var IC_BIRD = '<svg viewBox="0 -1 12 12" shape-rendering="crispEdges" aria-hidden="true">' + birdRects("#1b1c1d") + "</svg>";
  var IC_MAIL = '<svg viewBox="0 0 44 44" fill="none" stroke="#1b1c1d" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="34" height="24" rx="2" fill="#fff"/><path d="M5 12l17 13 17-13"/></svg>';
  var IC_OK = '<svg viewBox="0 0 44 44" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="square" aria-hidden="true"><path d="M10 23l9 9 16-18"/></svg>';
  function head(icon, title, sub) {
    return '<div class="wh"><span class="wic">' + icon + '</span><div><h2>' + title + '</h2><p>' + sub + '</p></div></div>';
  }
  function field(label, input, hint) {
    return '<label class="fld"><span class="fl">' + label + '</span>' + input + (hint ? '<span class="fh">' + hint + '</span>' : "") + "</label>";
  }
  function bindEye(root) {
    root.querySelectorAll(".eye").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = b.parentNode.querySelector("input"), show = i.type === "password";
        i.type = show ? "text" : "password"; b.textContent = show ? "скрыть" : "показать"; b.setAttribute("aria-pressed", show);
      });
    });
  }
  function fmtPhone(v) {            // +7 701 123 45 67
    var d = v.replace(/\D/g, "");
    if (!d) return "";
    if (d[0] === "8") d = "7" + d.slice(1);
    if (d[0] !== "7" && v.trim()[0] !== "+") d = "7" + d;
    if (v.trim()[0] === "+" && d[0] !== "7") return "+" + d.slice(0, 15);
    d = d.slice(0, 11);
    var o = "+7";
    if (d.length > 1) o += " " + d.slice(1, 4);
    if (d.length > 4) o += " " + d.slice(4, 7);
    if (d.length > 7) o += " " + d.slice(7, 9);
    if (d.length > 9) o += " " + d.slice(9, 11);
    return o;
  }
  function buildReq(body) {
    if (!sb) {
      body.innerHTML = head(IC_MAIL, "База не подключена", "Нужен Supabase") + '<p>Вставьте Project URL и anon key из Supabase в <b>js/data.js</b> (поле <b>supabase</b>). Подробности в README.</p>';
      return;
    }
    var items = bagItems(), list = "";
    if (items.length) {
      list = '<div class="rcpt"><div class="rt">Ваш заказ</div>' + items.map(function (i) {
        return '<div class="rl"><span>' + esc(i.name) + " × " + i.qty + "</span><i></i><b>" + money(i.price * i.qty) + "</b></div>";
      }).join("") + '<div class="rl sum"><span>Итого</span><i></i><b>' + money(bagSubtotal()) + "</b></div></div>";
    }
    var who = user ? '<div class="who">Вы вошли как <b>@' + esc(userNick() || "аккаунт") + "</b>: заявка сохранится в вашем аккаунте</div>" : '<div class="who">Без регистрации. <button type="button" class="lnk" id="reqLogin">Войти</button>, чтобы видеть свои заявки</div>';
    body.classList.add("fancy");
    body.innerHTML = head(IC_MAIL, "Оставить заявку", "Оставьте контакты, и мы свяжемся с вами") + who + list +
      '<form class="fform" id="reqForm" novalidate>' +
      field("Имя", '<input name="name" type="text" autocomplete="name" maxlength="80" placeholder="Как к вам обращаться" value="' + esc(userName()) + '" required>') +
      field("Телефон (WhatsApp)", '<input name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="+7 ___ ___ __ __" required>') +
      field("Комментарий", '<textarea name="comment" rows="3" maxlength="1000" placeholder="Размер, цвет, пожелания (необязательно)"></textarea>') +
      '<input name="site" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">' +
      '<p class="fmsg" id="reqMsg" role="status"></p>' +
      '<button class="gobtn" type="submit"><span>Отправить заявку</span><i aria-hidden="true">&rarr;</i></button></form>';
    var form = body.querySelector("#reqForm"), msg = body.querySelector("#reqMsg");
    function say(t, cls) { msg.className = "fmsg" + (cls ? " " + cls : ""); msg.textContent = t; }
    var lg = body.querySelector("#reqLogin"); if (lg) lg.addEventListener("click", function () { closeWin("req"); openWin("acc"); });
    form.elements.phone.addEventListener("input", function (e) { e.target.value = fmtPhone(e.target.value); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = form.elements, name = f.name.value.trim(), phone = f.phone.value.trim(), btn = form.querySelector("button[type=submit]");
      if (f.site.value) return; /* ловушка для ботов */
      if (name.length < 2) { say("Введите имя", "err"); f.name.focus(); return; }
      if (phone.replace(/\D/g, "").length < 10 || !/^[+\d][\d\s()\-]{6,}$/.test(phone)) { say("Введите корректный телефон", "err"); f.phone.focus(); return; }
      if (Date.now() - lastReq() < 30000) { say("Заявка уже отправлена, подождите немного", "err"); return; }
      btn.disabled = true; say("Отправляю…");
      var its = bagItems();
      sb.from("requests").insert({ user_id: user ? user.id : null, name: name, phone: phone, comment: f.comment.value.trim() || null, items: its.length ? its : null, total: its.length ? bagSubtotal() : null })
        .then(function (r) {
          btn.disabled = false;
          if (r.error) { say("Не удалось отправить. Попробуйте ещё раз или напишите нам напрямую.", "err"); return; }
          markReq();
          body.innerHTML = '<div class="done"><span class="tick">' + IC_OK + '</span><h2>Заявка отправлена</h2><p>Спасибо, ' + esc(name) + '! Мы скоро свяжемся с вами по номеру <b>' + esc(phone) + '</b>.</p><button type="button" class="gobtn alt" id="reqClose"><span>Закрыть</span></button></div>';
          body.querySelector("#reqClose").addEventListener("click", function () { closeWin("req"); });
        }, function () { btn.disabled = false; say("Нет связи с сервером, проверьте интернет", "err"); });
    });
  }
  $("reqBtn").addEventListener("click", function () { openWin("req"); });


  /* ---------- аккаунт: вход по нику (Supabase Auth, сессия в куки) ----------
     Supabase входит по почте, поэтому ник превращается в служебный адрес ник@authDomain. Настоящая почта не нужна,
     письма не отправляются (в Supabase должен быть выключен Confirm email). */
  var AUTH_DOMAIN = CFG.authDomain || "users.royale-shop.app";
  function nickOk(n) { return /^[a-z0-9][a-z0-9_.-]{2,19}$/.test(n); }
  function nickMail(n) { return n + "@" + AUTH_DOMAIN; }
  function userMeta() { return (user && user.user_metadata) || {}; }
  function userNick() { return userMeta().nick || ((user && user.email) || "").split("@")[0]; }
  function userName() { return user ? (userMeta().name || userMeta().nick || "") : ""; }
  function authErr(e) {
    var t = String((e && e.message) || "").toLowerCase(), c = String((e && (e.code || e.error_code)) || "").toLowerCase(), st = e && e.status;
    var tail = " [" + (c || st || "ошибка") + "]";                 // код ошибки сервера: по нему видно, что именно сломалось
    if (c === "invalid_credentials" || t.indexOf("invalid login") >= 0) return "Неверный ник или пароль";
    if (c === "user_already_exists" || c === "email_exists" || t.indexOf("already") >= 0) return "Этот ник уже занят, выберите другой";
    if (c === "email_not_confirmed" || t.indexOf("not confirmed") >= 0) return "Вход не подтверждён: в Supabase выключите Confirm email" + tail;
    if (c === "over_email_send_rate_limit" || t.indexOf("email rate limit") >= 0) return "Упёрлись в лимит писем Supabase: выключите Confirm email" + tail;
    if (c === "over_request_rate_limit" || st === 429 || t.indexOf("rate") >= 0 || t.indexOf("too many") >= 0) return "Слишком много попыток, подождите минуту" + tail;
    if (c === "signup_disabled" || t.indexOf("signups not allowed") >= 0) return "Регистрация выключена в Supabase (Authentication → Sign In / Providers → Allow new users to sign up)" + tail;
    if (c === "email_address_invalid" || c === "validation_failed" || (t.indexOf("email") >= 0 && t.indexOf("invalid") >= 0)) return "Сервер отклонил служебный адрес ник@" + AUTH_DOMAIN + ": у домена нет почтовых MX-записей. Укажите свой домен в js/data.js (authDomain)" + tail;
    if (c === "weak_password" || t.indexOf("password") >= 0) return "Пароль слишком простой: добавьте символов или цифр" + tail;
    if (t.indexOf("database error") >= 0 || c === "unexpected_failure") return "Сервер не смог создать профиль: заново запустите db/setup.sql в Supabase" + tail;
    if (st === 401 || st === 403 || t.indexOf("api key") >= 0) return "Сервер не принял ключ: проверьте url и anonKey в js/data.js" + tail;
    return "Не получилось, попробуйте ещё раз" + tail;
  }
  function updateAccUI() {
    var b = $("accBtn"); if (!b) return;
    var nk = user ? userNick() : "";
    $("accTxt").textContent = user ? "@" + nk : "Войти";
    $("accIc").innerHTML = user ? '<b class="av">' + esc(nk.charAt(0).toUpperCase()) + "</b>" : IC_USER;
    b.classList.toggle("on", !!user);
    b.setAttribute("aria-label", user ? "Аккаунт @" + nk : "Войти или открыть аккаунт");
    if (wins.acc) { wins.acc.body.innerHTML = ""; buildAcc(wins.acc.body); }
  }
  function buildAcc(body) {
    body.classList.add("fancy");
    if (!sb) {
      body.innerHTML = head(IC_BIRD, "База не подключена", "Нужен Supabase") + '<p>Вставьте Project URL и anon key из Supabase в <b>js/data.js</b>. Подробности в README.</p>';
      return;
    }
    if (user) { buildProfile(body); return; }
    var mode = "in";
    body.innerHTML = head(IC_BIRD, '<span id="accTtl">С возвращением</span>', '<span id="accSub">Войдите по нику и паролю</span>') +
      '<div class="seg2" role="tablist"><button type="button" role="tab" data-m="in" aria-selected="true">Вход</button><button type="button" role="tab" data-m="up" aria-selected="false">Регистрация</button></div>' +
      '<form class="fform" id="authForm" novalidate>' +
      field("Ник", '<span class="inp"><b class="pre">@</b><input name="nick" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="например, pipit" required></span>', '<span id="nickHint" hidden>3–20 символов: латиница, цифры, _ . -</span>') +
      field("Пароль", '<span class="inp"><input name="pass" type="password" autocomplete="current-password" maxlength="72" placeholder="минимум 8 символов" required><button type="button" class="eye" aria-pressed="false">показать</button></span>') +
      '<p class="fmsg" id="authMsg" role="status"></p>' +
      '<button class="gobtn" type="submit"><span id="goTxt">Войти</span><i aria-hidden="true">&rarr;</i></button></form>' +
      '<p class="fnote">Вход сохраняется в куки на этом устройстве, пока вы не нажмёте «Выйти». Почта не нужна.</p>';
    bindEye(body);
    var form = body.querySelector("#authForm"), msg = body.querySelector("#authMsg"), tabs = body.querySelectorAll(".seg2 button");
    function say(t, cls) { msg.className = "fmsg" + (cls ? " " + cls : ""); msg.textContent = t; }
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        mode = t.getAttribute("data-m");
        tabs.forEach(function (x) { x.setAttribute("aria-selected", x === t ? "true" : "false"); });
        body.querySelector("#nickHint").hidden = mode !== "up";
        body.querySelector("#accTtl").textContent = mode === "up" ? "Создать аккаунт" : "С возвращением";
        body.querySelector("#accSub").textContent = mode === "up" ? "Придумайте ник и пароль" : "Войдите по нику и паролю";
        body.querySelector("#goTxt").textContent = mode === "up" ? "Создать аккаунт" : "Войти";
        form.elements.pass.autocomplete = mode === "up" ? "new-password" : "current-password";
        say("");
      });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = form.elements, nick = f.nick.value.trim().replace(/^@/, "").toLowerCase(), pass = f.pass.value, btn = form.querySelector("button[type=submit]");
      if (!nickOk(nick)) { say("Ник: 3–20 символов, латиница, цифры, _ . -", "err"); f.nick.focus(); return; }
      if (pass.length < 8) { say("Пароль: минимум 8 символов", "err"); f.pass.focus(); return; }
      btn.disabled = true; say(mode === "up" ? "Создаю аккаунт…" : "Вхожу…");
      var job = mode === "up"
        ? sb.auth.signUp({ email: nickMail(nick), password: pass, options: { data: { nick: nick, name: nick } } })
        : sb.auth.signInWithPassword({ email: nickMail(nick), password: pass });
      job.then(function (r) {
        btn.disabled = false;
        if (r.error) { console.error("auth", r.error); say(authErr(r.error), "err"); return; }
        if (mode === "up" && !r.data.session) { say("Аккаунт создан, но вход не открылся: в Supabase выключите Confirm email.", "err"); return; }
        toast(mode === "up" ? "Аккаунт создан" : "Вы вошли");
      }, function (err) { btn.disabled = false; console.error("auth", err); say(err && err.name === "AuthRetryableFetchError" ? "Нет связи с сервером, проверьте интернет" : authErr(err), "err"); });
    });
  }
  var STATUS = { "new": "Новая", "work": "В работе", done: "Выполнена", cancel: "Отменена" };
  function buildProfile(body) {
    var nm = userMeta().name || "";
    body.innerHTML = '<div class="pcard"><span class="wic big">' + IC_BIRD + '</span><div class="pn">@' + esc(userNick()) + '</div><div class="ps">аккаунт Royale</div></div>' +
      '<form class="fform" id="profForm" novalidate>' + field("Имя для заявок", '<input name="name" type="text" autocomplete="name" maxlength="80" value="' + esc(nm) + '" placeholder="Как к вам обращаться">') +
      '<p class="fmsg" id="profMsg" role="status"></p><button class="gobtn" type="submit"><span>Сохранить</span></button></form>' +
      '<div class="sec">Мои заявки</div><div id="myReq" class="mine">Загружаю…</div>' +
      '<button type="button" class="outbtn" id="outBtn">Выйти из аккаунта</button>';
    var msg = body.querySelector("#profMsg");
    body.querySelector("#profForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = e.target.elements.name.value.trim(); if (v.length < 2) { msg.className = "fmsg err"; msg.textContent = "Введите имя (минимум 2 символа)"; return; }
      sb.auth.updateUser({ data: { name: v } }).then(function (r) {
        if (r.error) { msg.className = "fmsg err"; msg.textContent = "Не удалось сохранить"; return; }
        sb.from("profiles").update({ name: v }).eq("id", user.id).then(function () { /* профиль обновлён */ });
        msg.className = "fmsg ok"; msg.textContent = "Сохранено";
      });
    });
    body.querySelector("#outBtn").addEventListener("click", function () { sb.auth.signOut().then(function () { toast("Вы вышли"); }); });
    sb.from("requests").select("created_at,total,status,items").order("created_at", { ascending: false }).limit(10).then(function (r) {
      var box = body.querySelector("#myReq"); if (!box) return;
      if (r.error) { box.textContent = "Не удалось загрузить заявки"; return; }
      if (!r.data.length) { box.innerHTML = '<div class="empty">Заявок пока нет</div>'; return; }
      box.innerHTML = r.data.map(function (q) {
        var d = new Date(q.created_at).toLocaleDateString("ru-RU"), n = (q.items || []).reduce(function (s, i) { return s + i.qty; }, 0);
        return '<div class="ritem"><div><b>' + d + "</b><span>" + (n ? n + " шт. на " + money(q.total) : "Без товаров") + '</span></div><em data-s="' + esc(q.status) + '">' + esc(STATUS[q.status] || q.status) + "</em></div>";
      }).join("");
    });
  }
  if (sb) {
    sb.auth.onAuthStateChange(function (ev, session) {
      setTimeout(function () { user = session ? session.user : null; updateAccUI(); }, 0);   // не вызываем запросы внутри колбэка
    });
  }
  $("accBtn").addEventListener("click", function () { openWin("acc"); });

  function buildArcade(body) {
    wins.arcade.dispose = window.PipitArcade.mount(body, BIRD);
  }

  function buildBag() { renderBag(); }
  function renderBag() {
    var body = wins.bag.body;
    var ids = Object.keys(state.bag).filter(function (k) { return state.bag[k] > 0 && byId(k); });
    if (!ids.length) {
      body.innerHTML = '<div class="bag-empty"><h2>Корзина пуста</h2><p>' + (PRODUCTS.length ? "Выберите товар из списка, и он появится здесь." : "Товаров пока нет. Загляните позже.") + '</p></div>';
      return;
    }
    var html = "";
    ids.forEach(function (id) {
      var p = byId(id), q = state.bag[id];
      html += '<div class="line"><div>' + (productImg(p) || '<div class="noimg"></div>') + '</div><div><div class="nm">' + esc(p.name) + '</div><div>' + money(p.price) + '</div>' +
        '<div class="qty"><button type="button" data-dec="' + esc(id) + '" aria-label="Меньше">−</button><span>' + q + '</span><button type="button" data-inc="' + esc(id) + '" aria-label="Больше">+</button></div></div>' +
        '<div><div class="nm">' + money(p.price * q) + '</div><button class="rm" type="button" data-rm="' + esc(id) + '">Удалить</button></div></div>';
    });
    var sub = bagSubtotal(), ship = sub >= CFG.freeShippingFrom ? 0 : CFG.shippingEU;
    html += '<div class="total"><span>Подытог</span><span>' + money(sub) + '</span></div>' +
      '<div class="total" style="font-weight:400;font-size:15px;padding-top:0"><span>Доставка (Казахстан)</span><span>' + (ship ? money(ship) : "Бесплатно") + '</span></div>' +
      '<div class="total"><span>Итого</span><span>' + money(sub + ship) + '</span></div>' +
      '<button class="checkout" type="button" id="co">Оставить заявку на заказ</button><p class="small">Оплата на сайте не требуется: мы свяжемся и подтвердим заказ.</p>';
    body.innerHTML = html;
  }
  layer.addEventListener("click", function (e) {
    var d = e.target.closest("[data-dec]"), i = e.target.closest("[data-inc]"), r = e.target.closest("[data-rm]");
    if (i) state.bag[i.getAttribute("data-inc")]++;
    else if (d) { var k = d.getAttribute("data-dec"); state.bag[k] = Math.max(0, state.bag[k] - 1); }
    else if (r) state.bag[r.getAttribute("data-rm")] = 0;
    else if (e.target.id === "co") { closeWin("bag"); if (!wins.req) openWin("req"); return; }
    else return;
    updateBagUI();
  });

  /* ---------- часы: время устройства посетителя ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  var dateFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });

  function tickClock() {
    var now = new Date(), h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    $("clockTxt").textContent = pad(h) + ":" + pad(m);
    $("hh").style.transform = "rotate(" + ((h % 12) * 30 + m / 2) + "deg)";
    $("mm").style.transform = "rotate(" + (m * 6 + s / 10) + "deg)";
    if (wins.clock) {
      var big = wins.clock.body.querySelector(".wx-time"), dt = wins.clock.body.querySelector(".wx-date");
      if (big) { big.textContent = pad(h) + ":" + pad(m) + ":" + pad(s); var ds = dateFmt.format(now); dt.textContent = ds.charAt(0).toUpperCase() + ds.slice(1); }
    }
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ---------- погода: Open-Meteo, без ключа ---------- */
  var ICONS = {
    cloud: '<svg viewBox="0 0 32 32" fill="none" stroke="#1b1c1d" stroke-width="1.6"><path d="M9 24h15a5 5 0 0 0 0-10 7 7 0 0 0-13-1.5A5.5 5.5 0 0 0 9 24z" fill="#e4e4e2"/></svg>',
    sun: '<svg viewBox="0 0 32 32" fill="none" stroke="#1b1c1d" stroke-width="1.6"><circle cx="16" cy="16" r="6" fill="#e4e4e2"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M25 7l-3 3M10 22l-3 3"/></svg>',
    rain: '<svg viewBox="0 0 32 32" fill="none" stroke="#1b1c1d" stroke-width="1.6"><path d="M9 20h15a5 5 0 0 0 0-10 7 7 0 0 0-13-1.5A5.5 5.5 0 0 0 9 20z" fill="#e4e4e2"/><path d="M11 24l-1.5 4M17 24l-1.5 4M23 24l-1.5 4"/></svg>',
    snow: '<svg viewBox="0 0 32 32" fill="none" stroke="#1b1c1d" stroke-width="1.6"><path d="M9 20h15a5 5 0 0 0 0-10 7 7 0 0 0-13-1.5A5.5 5.5 0 0 0 9 20z" fill="#e4e4e2"/><path d="M11 25h.1M17 27h.1M23 25h.1M14 29h.1M20 29h.1" stroke-width="3" stroke-linecap="round"/></svg>'
  };
  function wx(code) {
    if (code === 0) return ["sun", "Ясно"];
    if (code === 1 || code === 2) return ["sun", "Малооблачно"];
    if (code === 3) return ["cloud", "Облачно"];
    if (code === 45 || code === 48) return ["cloud", "Туман"];
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return ["rain", "Дождь"];
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ["snow", "Снег"];
    if (code >= 95) return ["rain", "Гроза"];
    return ["cloud", "Облачно"];
  }

  function loadWeather(lat, lon, place, box) {
    box.innerHTML = '<p class="small">Загружаю погоду…</p>';
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&forecast_days=2&timezone=auto&wind_speed_unit=ms";
    fetch(url).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); }).then(function (d) {
      var cur = d.current, w = wx(cur.weather_code);
      var idx = d.hourly.time.indexOf(cur.time.slice(0, 13) + ":00");
      if (idx < 0) idx = 0;
      var items = "";
      for (var i = 1; i <= 5 && idx + i < d.hourly.time.length; i++) {
        var hh = d.hourly.time[idx + i].slice(11, 13) + ":00", hw = wx(d.hourly.weather_code[idx + i]);
        items += "<div>" + hh + ICONS[hw[0]] + Math.round(d.hourly.temperature_2m[idx + i]) + "°</div>";
      }
      box.innerHTML = '<div class="wx-now">' + ICONS[w[0]] + '<div><div class="deg">' + Math.round(cur.temperature_2m) + '°C</div><div>' + w[1] + ", ветер " + Math.round(cur.wind_speed_10m) + ' м/с</div></div></div>' +
        '<div class="hours">' + items + '</div><p class="small">' + esc(place) + '. Данные Open-Meteo.</p>';
    }).catch(function () {
      box.innerHTML = '<p class="small">Не удалось загрузить погоду. Проверьте интернет и попробуйте ещё раз.</p>';
    });
  }

  function buildClock(body) {
    body.innerHTML = '<p class="wx-time">--:--:--</p><p class="wx-date sub"></p>' +
      '<div class="wx-where"><span id="wxPlace"></span><button type="button" id="wxGeo">Моё место</button></div><div id="wxBox"></div>' +
      '<p class="small">Время взято с вашего устройства.</p>';
    var box = body.querySelector("#wxBox"), place = body.querySelector("#wxPlace");
    place.textContent = CFG.weather.city;
    loadWeather(CFG.weather.lat, CFG.weather.lon, CFG.weather.city, box);
    body.querySelector("#wxGeo").addEventListener("click", function () {
      if (!navigator.geolocation) { toast("Браузер не умеет определять место"); return; }
      navigator.geolocation.getCurrentPosition(function (pos) {
        place.textContent = "Ваше место";
        loadWeather(pos.coords.latitude.toFixed(3), pos.coords.longitude.toFixed(3), "Ваше место", box);
      }, function () { toast("Не удалось определить место"); }, { timeout: 8000 });
    });
    wins.clock.timer = setInterval(tickClock, 1000);
    tickClock();
  }

  /* маленькая кнопка справа снизу: сообщение на весь экран */
  var bigScreen = $("bigScreen");
  function closeBig() { bigScreen.hidden = true; $("secretBtn").focus(); }
  $("secretBtn").addEventListener("click", function () { bigScreen.hidden = false; bigScreen.focus(); });
  bigScreen.addEventListener("click", closeBig);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !bigScreen.hidden) { e.stopImmediatePropagation(); closeBig(); } }, true);

  renderGrid();
  renderStage();
  updateBagUI();

  /* миниатюры карточек делаем из самой 3D-модели, если нет фото */
  PRODUCTS.forEach(function (p) {
    if (!p.model || p.image) return;
    loadTryon().then(function (m) { var zz = (p.view && p.view.zoom) || 1; return m.thumbnail(p.model, 640, 640, 1 + (zz - 1) * 0.5); }).then(function (url) {
      p.thumb = url; renderGrid(); updateBagUI();
    }).catch(function () { /* без миниатюры карточка остаётся пустой */ });
  });
})();
