/* Pipit shop: логика страницы. Данные товаров лежат в js/data.js */
(function () {
  "use strict";

  var CFG = window.PIPIT;
  var PRODUCTS = CFG.products;

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
  $("year").textContent = new Date().getFullYear();

  var state = { sel: PRODUCTS.length ? PRODUCTS[0].id : null, mode: "3d", bag: {} };
  var grid = $("grid"), hero = $("hero"), toastEl = $("toast"), toastTimer;
  var wins = {};

  function byId(id) { return PRODUCTS.filter(function (p) { return p.id === id; })[0]; }

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
        '<button class="pic" type="button" data-pick="' + esc(p.id) + '" aria-label="Показать: ' + esc(p.name) + '">' + productImg(p) + '</button>' +
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
      hero.innerHTML = '<div class="empty-state"><svg viewBox="0 0 12 10" shape-rendering="crispEdges" aria-hidden="true">' + birdRects("#1b1c1d") + '</svg>' +
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
      html += '<div class="line"><div>' + (p.image ? productImg(p) : '<div class="noimg"></div>') + '</div><div><div class="nm">' + esc(p.name) + '</div><div>' + money(p.price) + '</div>' +
        '<div class="qty"><button type="button" data-dec="' + esc(id) + '" aria-label="Меньше">−</button><span>' + q + '</span><button type="button" data-inc="' + esc(id) + '" aria-label="Больше">+</button></div></div>' +
        '<div><div class="nm">' + money(p.price * q) + '</div><button class="rm" type="button" data-rm="' + esc(id) + '">Удалить</button></div></div>';
    });
    var sub = bagSubtotal(), ship = sub >= CFG.freeShippingFrom ? 0 : CFG.shippingEU;
    html += '<div class="total"><span>Подытог</span><span>' + money(sub) + '</span></div>' +
      '<div class="total" style="font-weight:400;font-size:15px;padding-top:0"><span>Доставка (Казахстан)</span><span>' + (ship ? money(ship) : "Бесплатно") + '</span></div>' +
      '<div class="total"><span>Итого</span><span>' + money(sub + ship) + '</span></div>' +
      '<button class="checkout" type="button" id="co">Оформить заказ</button><p class="small">Демо-магазин: оплата не подключена.</p>';
    body.innerHTML = html;
  }
  layer.addEventListener("click", function (e) {
    var d = e.target.closest("[data-dec]"), i = e.target.closest("[data-inc]"), r = e.target.closest("[data-rm]");
    if (i) state.bag[i.getAttribute("data-inc")]++;
    else if (d) { var k = d.getAttribute("data-dec"); state.bag[k] = Math.max(0, state.bag[k] - 1); }
    else if (r) state.bag[r.getAttribute("data-rm")] = 0;
    else if (e.target.id === "co") { toast("Оплата пока не подключена"); return; }
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
    loadTryon().then(function (m) { return m.thumbnail(p.model); }).then(function (url) {
      p.thumb = url; renderGrid(); updateBagUI();
    }).catch(function () { /* без миниатюры карточка остаётся пустой */ });
  });
})();
