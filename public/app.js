(() => {
  const S = window.SHOP;
  const SOURCE = "https://us.yotoplay.com";
  const PAGE_SIZE = 40;
  const CART_KEY = "yoto-cart-v1";

  const CAT_BY_TYPE = {
    "player-unit": "player",
    "content-bundle": "combo",
    "accessories": "acc",
    "single-card": "single",
    "bundle": "pack",
    "soft-bundle": "pack",
  };
  const CAT_ORDER = { player: 0, combo: 1, acc: 2, tp: 3, pack: 4, single: 5 };
  // 年齡分組（與美國官網 ages-0-2 / 3-5 / 6-8 / 9-plus 分類相同）
  const AGE_GROUPS = { "0-2": [0, 2], "3-5": [3, 5], "6-8": [6, 8], "9+": [9, 99] };

  const $ = (s) => document.querySelector(s);
  const ntd = (n) => "NT$" + Math.round(n).toLocaleString("en-US");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // 售價公式：美金 × 匯率 + 固定加價
  function toNtd(usd, group) {
    const r = S.pricing[group];
    return Math.round(Number(usd) * r.rate + r.plus);
  }

  let products = [];
  let shown = PAGE_SIZE;
  const state = { cat: "all", q: "", sort: "rec", age: "", theme: "", lang: "english" };
  // 卡片類型：與美國官網選單相同的分類（value = 官網 /collections/ 網址）
  const THEMES = [
    ["music", "音樂兒歌"], ["favourite-characters", "人氣角色"], ["classic-stories", "經典名著"],
    ["education", "學習教育"], ["sleep-and-bedtime", "睡前助眠"], ["activities", "互動遊戲"],
    ["hidden-gems", "隱藏好卡"], ["stories", "故事"], ["action-adventure", "動作冒險"],
    ["animal-stories", "動物故事"], ["mindfulness-movement", "正念律動"],
    ["history-biography", "歷史人物"], ["fairy-tales", "童話"], ["fantasy", "奇幻"],
  ];
  // 官網分類清單（handle 依官網排序），由 Netlify function 或 data/collections.json 提供
  let colls = {};      // slug -> Set(handle)
  let bestRank = {};   // handle -> 官網 Best Sellers 名次
  let trendRank = {};  // handle -> 官網分類頁的排序（Trending）
  let cart = load();

  // ---------- 文字帶入 ----------
  const d = S.pricing.device, c = S.pricing.card;
  const ruleLine = `播放器／配件：美金 × ${d.rate}${d.plus ? ` + ${d.plus}` : ""}；故事卡／卡片套組：美金 × ${c.rate} + ${c.plus} 元`;
  $("#shopName").textContent = S.name;
  $("#footName").textContent = S.name;
  $("#shopBadge").textContent = S.badge || "";
  document.title = S.name;
  $("#ruleText").innerHTML = `商品價格＝<br>播放器／配件：美金 × ${d.rate}${d.plus ? ` + ${d.plus}` : ""}；<br>故事卡／卡片套組：美金 × ${c.rate} + ${c.plus} 元`;
  $("#footRule").textContent = ruleLine + `。無另外再收取代購費用。下單需先付 ${S.depositRate * 100}% 訂金，尾款取貨時付清。`;
  $("#depositText").textContent = `匯款 ${S.depositRate * 100}% 訂金，尾款於取貨時付清`;
  // LINE 官方帳號（@開頭）與個人 ID 的加好友連結格式不同
  const lineUrl = "https://line.me/R/ti/p/" + (S.lineId.startsWith("@") ? encodeURIComponent(S.lineId) : "~" + encodeURIComponent(S.lineId));
  // LINE 官方帳號的 QR Code 由 LINE 提供（個人 ID 沒有這個網址，就不顯示 QR）
  const lineQr = S.lineId.startsWith("@") ? `https://qr-official.line.me/sid/L/${encodeURIComponent(S.lineId.slice(1))}.png` : "";
  if ($("#lineStep")) $("#lineStep").innerHTML = `<span>LINE 官方帳號 <b>${esc(S.lineId)}</b></span>
    <a class="line-btn" href="${lineUrl}" target="_blank" rel="noopener">加入好友</a>`;

  // 三種加好友方式：按鈕（手機）、QR Code（電腦掃描）、搜尋 ID
  function lineBoxHtml() {
    return `<div class="line-box">
      <p class="line-title">加入 LINE 官方帳號，傳送訂單與匯款末五碼</p>
      <div class="line-ways">
        ${lineQr ? `<img class="line-qr" src="${lineQr}" alt="LINE 官方帳號 QR Code" width="120" height="120">` : ""}
        <div class="line-opts">
          <a class="line-btn big" href="${lineUrl}" target="_blank" rel="noopener">＋ 加入好友</a>
          <p>${lineQr ? "或用手機 LINE 掃描 QR Code，" : ""}或在 LINE 搜尋 ID：</p>
          <button type="button" class="line-id" id="copyLineId" title="點一下複製">${esc(S.lineId)} <small>複製</small></button>
        </div>
      </div>
    </div>`;
  }
  $("#footContact").textContent = (S.lineId.startsWith("@") ? "LINE 官方帳號：" : "LINE ID：") + S.lineId;
  $("#heroName").textContent = S.name;
  $("#rateNote").textContent = `固定匯率・播放器 ${d.rate}／卡片 ${c.rate}+${c.plus}`;

  // ---------- 抓官網商品 ----------
  async function fetchAll() {
    const all = [];
    for (let page = 1; page < 20; page++) {
      const res = await fetch(`${SOURCE}/products.json?limit=250&page=${page}`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const { products: list } = await res.json();
      if (!list.length) break;
      all.push(...list);
      $("#status").textContent = `正在同步美國官網商品…已取得 ${all.length} 件`;
    }
    return all;
  }

  function normalize(p, idx) {
    const group = S.typeMap[p.product_type];
    const cat = CAT_BY_TYPE[p.product_type];
    if (!group || !cat) return null;
    const tags = (p.tags || []).map((t) => t.toLowerCase());
    if (tags.includes("media:digital")) return null;           // 純數位版（無實體卡）不上架
    const variants = p.variants.filter((v) => Number(v.price) > 0).map((v) => {
      const now = toNtd(v.price, group);
      const was = v.compare_at_price && Number(v.compare_at_price) > Number(v.price) ? toNtd(v.compare_at_price, group) : null;
      return { id: v.id, title: v.title === "Default Title" ? "" : v.title, usd: Number(v.price), now, was, ok: v.available };
    });
    if (!variants.length) return null;                          // 官網標 $0 的（如保固替換品）不上架
    // 年齡：以官網商品頁顯示的建議年齡（age-min / age-max）為準；少數商品有多組標籤，取最寬範圍
    const nums = (k) => tags.filter((t) => t.startsWith(k + ":")).map((t) => Number(t.split(":")[1])).filter((n) => !isNaN(n));
    const mins = nums("age-min"), maxs = nums("age-max"), coll = nums("collection-age");
    const ageMin = mins.length ? Math.min(...mins) : coll.length ? Math.min(...coll) : null;
    const ageMax = maxs.length ? Math.max(...maxs) : coll.length ? Math.max(...coll) : null;
    const fantasy = tags.some((t) => t === "content-type:fantasy");
    const langs = tags.filter((t) => t.startsWith("language:")).map((t) => t.slice(9).replace(/^en$/, "english").replace(/^fr$/, "french"));
    return {
      handle: p.handle, title: p.title, vendor: p.vendor, cat, group, idx,
      img: p.images[0]?.src ? p.images[0].src + "&width=500" : "",
      variants, ageMin, ageMax, fantasy, langs,
      isNew: tags.includes("br-new") || tags.includes("new"),
      featured: S.featured.indexOf(p.handle),
    };
  }

  // 副廠配件：直接在 config.js 填台幣價格
  function thirdParty() {
    return (S.thirdParty || []).map((t, i) => {
      const opts = t.options && t.options.length ? t.options : [""];
      return {
        handle: "tp-" + (t.id || i), title: t.title, vendor: t.brand || "副廠", cat: "tp", idx: -1,
        img: t.img || "", note: t.note || "", ageMin: null, ageMax: null, fantasy: false, langs: [], isNew: false, featured: -1,
        variants: opts.map((o, j) => ({ id: `tp-${t.id || i}-${j}`, title: o, usd: 0, now: t.price, was: t.was || null, ok: t.inStock !== false })),
      };
    });
  }

  const best = (p) => p.variants.find((v) => v.ok) || p.variants[0];
  const offPct = (v) => (v.was ? Math.round((1 - v.now / v.was) * 100) : 0);

  // ---------- 列表 ----------
  function filtered() {
    // 拆成單字比對，例如「super simple songs」也能找到「Super Simple Songs Collection」「Super Simple Spooky Songs」
    const words = state.q.toLowerCase().replace(/[’']/g, "").split(/\s+/).filter(Boolean);
    // 選了年齡時，建議年齡「從這個區間開始」的卡片優先（例如選 3–5 歲，3–8 歲的排在 0–14 歲前面）
    const ageFit = (p) => {
      if (!state.age || p.ageMin == null) return 0;
      const [lo, hi] = AGE_GROUPS[state.age];
      return p.ageMin >= lo && p.ageMin <= hi ? 0 : 1;
    };
    // 推薦：官網 Best Sellers 名次 → 官網分類頁排序 → 其他
    const rank = (p) => bestRank[p.handle] ?? 1000 + (trendRank[p.handle] ?? 5000);
    const out = (p) => !p.variants.some((v) => v.ok);
    let list = products.filter((p) => {
      if (state.cat === "sale" && !p.variants.some((v) => v.was)) return false;
      if (!["all", "sale"].includes(state.cat) && p.cat !== state.cat) return false;
      if (state.theme && !(state.theme === "fantasy" ? p.fantasy : colls[state.theme]?.has(p.handle))) return false;
      // 語言：沒有語言標籤的（播放器、配件）一律顯示
      if (state.lang && p.langs.length && !p.langs.some((l) => l.includes(state.lang))) return false;
      if (state.age) {
        const [lo, hi] = AGE_GROUPS[state.age];
        if (p.ageMin == null || p.ageMin > hi || (p.ageMax ?? 99) < lo) return false;
      }
      if (words.length) {
        const hay = (p.title + " " + p.vendor).toLowerCase().replace(/[’']/g, "");
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const by = {
      rec: (a, b) => (b.featured > -1) - (a.featured > -1) || CAT_ORDER[a.cat] - CAT_ORDER[b.cat] || ageFit(a) - ageFit(b) || rank(a) - rank(b) || (offPct(best(b)) > 0) - (offPct(best(a)) > 0) || a.idx - b.idx,
      off: (a, b) => offPct(best(b)) - offPct(best(a)),
      asc: (a, b) => best(a).now - best(b).now,
      desc: (a, b) => best(b).now - best(a).now,
    }[state.sort];
    return list.sort((a, b) => out(a) - out(b) || by(a, b));
  }

  function priceHtml(v) {
    return `<div class="prices">
      <span class="price-now ${v.was ? "is-sale" : ""}">${ntd(v.now)}</span>
      ${v.was ? `<span class="price-was">${ntd(v.was)}</span><span class="save">省 ${ntd(v.was - v.now)}</span>` : ""}
    </div>`;
  }

  function cardHtml(p) {
    const v = best(p);
    const off = offPct(v);
    const allOut = !p.variants.some((x) => x.ok);
    const tag = allOut ? `<span class="tag tag-out">補貨中</span>`
      : off ? `<span class="tag tag-off">-${off}%</span>`
      : p.cat === "tp" ? `<span class="tag tag-tp">副廠</span>`
      : p.handle in bestRank ? `<span class="tag tag-hot">熱銷</span>`
      : p.isNew ? `<span class="tag tag-new">NEW</span>` : "";
    const ageTxt = p.ageMin != null ? `・${p.ageMin}${p.ageMax != null ? "–" + p.ageMax : "+"} 歲` : "";
    const select = p.variants.length > 1
      ? `<select data-variant>${p.variants.map((x) => `<option value="${x.id}" ${x.id === v.id ? "selected" : ""} ${x.ok ? "" : "disabled"}>${esc(x.title)}${x.ok ? "" : "（缺貨）"}</option>`).join("")}</select>` : "";
    return `<article class="card" data-handle="${esc(p.handle)}">
      ${tag}
      <div class="img">${p.img ? `<img loading="lazy" src="${esc(p.img)}" alt="${esc(p.title)}">` : ""}</div>
      <div class="body">
        <h4>${esc(p.title)}</h4>
        <span class="vendor">${esc(p.vendor)}${ageTxt}</span>
        ${p.note ? `<span class="note">${esc(p.note)}</span>` : ""}
        ${select}
        <div data-price>${priceHtml(v)}</div>
        <button class="add" data-add ${allOut ? "disabled" : ""}>${allOut ? "暫無庫存" : "加入購物車"}</button>
      </div>
    </article>`;
  }

  function render() {
    const list = filtered();
    $("#grid").innerHTML = list.slice(0, shown).map(cardHtml).join("");
    $("#status").textContent = list.length ? `共 ${list.length} 件商品` : state.cat === "tp" && !state.q ? "副廠配件即將上架，敬請期待！" : "找不到符合的商品";
    const rest = list.length - shown;
    $("#more").hidden = rest <= 0;
    $("#more").textContent = `載入更多（還有 ${rest} 件）`;
  }

  function renderFeatured() {
    const items = S.featured.map((h) => products.find((p) => p.handle === h)).filter(Boolean);
    $("#featured").innerHTML = items.map((p) => {
      const v = best(p);
      return `<div class="feat card" data-handle="${esc(p.handle)}">
        ${offPct(v) ? `<span class="tag tag-off">-${offPct(v)}%</span>` : ""}
        <img src="${esc(p.img)}" alt="">
        <div style="flex:1">
          <h4>${esc(p.title)}</h4>
          ${priceHtml(v)}
          <button class="add" data-add style="margin-top:8px;width:100%">加入購物車</button>
        </div>
      </div>`;
    }).join("");
  }

  function renderTicker() {
    const sales = products.filter((p) => offPct(best(p)) > 0).sort((a, b) => offPct(best(b)) - offPct(best(a))).slice(0, 8);
    const bits = sales.length
      ? sales.map((p) => `<span>🔥 ${esc(p.title)} ${ntd(best(p).now)}（-${offPct(best(p))}%）</span>`)
      : [`<span>美國官網價格即時同步・固定匯率・價格透明</span>`];
    $("#ticker").innerHTML = bits.join("") + bits.join(""); // 兩份以無縫捲動
  }

  // ---------- 卡片互動 ----------
  document.addEventListener("change", (e) => {
    if (!e.target.matches("[data-variant]")) return;
    const el = e.target.closest("[data-handle]");
    const p = products.find((x) => x.handle === el.dataset.handle);
    const v = p.variants.find((x) => String(x.id) === e.target.value);
    el.querySelector("[data-price]").innerHTML = priceHtml(v);
  });

  document.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-add]");
    if (addBtn) {
      const el = addBtn.closest("[data-handle]");
      const p = products.find((x) => x.handle === el.dataset.handle);
      const sel = el.querySelector("[data-variant]");
      const v = sel ? p.variants.find((x) => String(x.id) === sel.value) : best(p);
      addToCart(p, v);
      return;
    }
    const jump = e.target.closest("[data-jump]");
    if (jump) setCat({ device: "player", card: "single", acc: "acc" }[jump.dataset.jump]);
  });

  const AGE_CATS = ["all", "sale", "single", "pack"];
  function setCat(cat) {
    state.cat = cat; shown = PAGE_SIZE;
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.cat === cat));
    $("#ages").hidden = $("#themes").hidden = !AGE_CATS.includes(cat);
    if ($("#ages").hidden) { setAge("", false); setTheme("", false); }
    render();
  }
  function setAge(age, rerender = true) {
    state.age = age; shown = PAGE_SIZE;
    document.querySelectorAll("#ages button").forEach((b) => b.classList.toggle("on", b.dataset.age === age));
    if (rerender) render();
  }
  function setTheme(theme, rerender = true) {
    state.theme = theme; shown = PAGE_SIZE;
    document.querySelectorAll("#themes button").forEach((b) => b.classList.toggle("on", b.dataset.theme === theme));
    if (rerender) render();
  }
  $("#themeList").innerHTML = `<button data-theme="" class="on">全部</button>` +
    THEMES.map(([v, label]) => `<button data-theme="${v}">${label}</button>`).join("");
  $("#lang").addEventListener("change", (e) => { state.lang = e.target.value; shown = PAGE_SIZE; render(); });
  $("#themes").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-theme]"); if (!b) return;
    if (b.dataset.theme && state.cat === "all") { state.cat = "single"; document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("on", x.dataset.cat === "single")); }
    setTheme(b.dataset.theme);
  });

  // 熱門搜尋按鈕
  $("#quick").innerHTML = (S.quickSearch || []).map((w) => typeof w === "string"
    ? `<button type="button" data-qs="${esc(w)}">${esc(w)}</button>`
    : `<button type="button" data-qc="${esc(w.collection)}">${esc(w.label)}</button>`).join("");
  $("#quick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-qs],[data-qc]"); if (!b) return;
    const same = b.classList.contains("on");
    setAge("", false); setTheme("", false); setCat("all");
    $("#q").value = state.q = !same && b.dataset.qs ? b.dataset.qs : "";
    if (!same && b.dataset.qc) setTheme(b.dataset.qc, false);
    document.querySelectorAll("#quick button").forEach((x) => x.classList.toggle("on", !same && x === b));
    shown = PAGE_SIZE; render();
  });

  $("#ages").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-age]"); if (!b) return;
    // 選年齡時自動切到「故事卡」並用推薦排序
    if (b.dataset.age && state.cat === "all") { state.cat = "single"; document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("on", x.dataset.cat === "single")); }
    setAge(b.dataset.age);
  });
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setCat(b.dataset.cat); });
  let qTimer;
  $("#q").addEventListener("input", (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value; document.querySelectorAll("#quick button").forEach((x) => x.classList.toggle("on", x.dataset.qs === state.q)); shown = PAGE_SIZE; render(); }, 200); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("#more").addEventListener("click", () => { shown += PAGE_SIZE; render(); });

  // ---------- 購物車 ----------
  function load() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } }
  function save() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {} updateCount(); }
  function updateCount() { $("#cartCount").textContent = cart.reduce((s, l) => s + l.qty, 0); }

  // 以最新官網價格更新購物車內的價格
  function refreshCartPrices() {
    cart = cart.filter((l) => {
      const p = products.find((x) => x.handle === l.handle);
      const v = p && p.variants.find((x) => x.id === l.id);
      if (!v) return false;
      Object.assign(l, { now: v.now, was: v.was, usd: v.usd });
      return true;
    });
    save();
  }

  function addToCart(p, v) {
    const hit = cart.find((l) => l.id === v.id);
    if (hit) hit.qty++;
    else cart.push({ id: v.id, handle: p.handle, title: p.title, variant: v.title, img: p.img, usd: v.usd, now: v.now, was: v.was, qty: 1 });
    save();
    toast(`已加入：${p.title}`);
  }

  const totals = () => {
    const total = cart.reduce((s, l) => s + l.now * l.qty, 0);
    const was = cart.reduce((s, l) => s + (l.was || l.now) * l.qty, 0);
    const deposit = Math.ceil(total * S.depositRate);
    return { total, saved: was - total, deposit, rest: total - deposit };
  };

  function sumHtml() {
    const t = totals();
    return `${t.saved > 0 ? `<div class="sum" style="color:var(--sale)"><span>官網特價共省</span><span>-${ntd(t.saved)}</span></div>` : ""}
      <div class="sum big"><span>合計</span><span>${ntd(t.total)}</span></div>
      <div class="sum dep"><span>應付訂金（${S.depositRate * 100}%）</span><span>${ntd(t.deposit)}</span></div>
      <div class="sum"><span>尾款（取貨時付）</span><span>${ntd(t.rest)}</span></div>`;
  }

  function showCart() {
    $("#drawerTitle").textContent = "購物車";
    if (!cart.length) {
      $("#drawerBody").innerHTML = `<p class="empty">購物車是空的</p>`;
      $("#drawerFoot").innerHTML = "";
      return;
    }
    $("#drawerBody").innerHTML = cart.map((l, i) => `
      <div class="line">
        <img src="${esc(l.img)}" alt="">
        <div><h5>${esc(l.title)}</h5>${l.variant ? `<small>${esc(l.variant)}</small><br>` : ""}
          <span class="price-now ${l.was ? "is-sale" : ""}" style="font-size:15px">${ntd(l.now)}</span>
          ${l.was ? `<span class="price-was">${ntd(l.was)}</span>` : ""}</div>
        <div class="qty"><button data-q="${i}" data-d="-1">−</button><span>${l.qty}</span><button data-q="${i}" data-d="1">＋</button></div>
      </div>`).join("");
    $("#drawerFoot").innerHTML = sumHtml() + `<button class="btn btn-sale" id="goCheckout">前往結帳</button>`;
  }

  function showCheckout() {
    $("#drawerTitle").textContent = "填寫訂購資料";
    const saved = (() => { try { return JSON.parse(localStorage.getItem("yoto-buyer")) || {}; } catch { return {}; } })();
    // 欄位：全部必填，並檢查格式（訊息用中文）
    const f = (id, label, attrs = "", hint = "") => `<label for="${id}">${label} <span class="req">*</span></label>
      <input id="${id}" name="${id}" required ${attrs} value="${esc(saved[id] || "")}">${hint ? `<div class="hint">${hint}</div>` : ""}`;
    $("#drawerBody").innerHTML = `<form class="form" id="orderForm" novalidate>
      <p class="privacy">🔒 以下個人資料<b>僅供聯繫訂單使用</b>，不做其他用途。</p>
      ${f("name", "姓名", 'autocomplete="name" maxlength="30"')}
      ${f("phone", "手機", 'type="tel" inputmode="numeric" autocomplete="tel" maxlength="10" pattern="09[0-9]{8}" placeholder="09XXXXXXXX"', "10 碼數字，例如 0912345678")}
      ${f("line", "LINE ID", 'maxlength="40"', "方便我們用 LINE 和你確認訂單")}
      ${f("email", "Email", 'type="email" autocomplete="email" maxlength="80" placeholder="name@example.com"')}
      <fieldset class="store">
        <legend>7-11 賣貨便取貨門市 <span class="req">*</span></legend>
        <a class="store-link" href="https://emap.pcsc.com.tw/" target="_blank" rel="noopener">🔍 打開 7-11 電子地圖查詢門市 ↗</a>
        <div class="hint">可用縣市、店名或路名查詢；點選門市即可看到店號。請把「店名」和「店號」都填上，我們會雙重核對。</div>
        <div class="store-row">
          <div>${f("storeName", "門市名稱", 'maxlength="20" placeholder="例：鑫台北"')}</div>
          <div>${f("storeId", "門市店號", 'inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="6 碼數字"')}</div>
        </div>
      </fieldset>
      <label for="note">備註（選填）</label><textarea id="note" name="note" rows="2" maxlength="300"></textarea>
    </form>`;
    $("#drawerFoot").innerHTML = sumHtml() + `<button class="btn btn-sale" type="submit" form="orderForm">送出訂單</button><button class="btn" id="backCart">返回購物車</button>`;
    const form = $("#orderForm");
    // 手機、店號只留數字（客人打 0912-345-678 也能自動整理）
    ["phone", "storeId"].forEach((n) => form[n].addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, ""); }));
    form.querySelectorAll("input").forEach((el) => el.addEventListener("input", () => { el.setCustomValidity(""); el.classList.remove("bad"); }));
    form.addEventListener("submit", submitOrder);
  }

  const MSG = {
    name: "請填寫姓名",
    phone: "手機請填 10 碼數字，09 開頭（例如 0912345678）",
    line: "請填寫 LINE ID",
    email: "Email 格式不正確，需包含 @（例如 name@example.com）",
    storeName: "請填寫 7-11 門市名稱",
    storeId: "門市店號為 6 碼數字，可在 7-11 電子地圖查詢",
  };
  function validate(form) {
    let first = null;
    form.querySelectorAll("input[required]").forEach((el) => {
      el.value = el.value.trim();
      el.setCustomValidity("");
      const ok = el.checkValidity() && !(el.name === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value));
      if (!ok) { el.setCustomValidity(MSG[el.name] || "請填寫此欄位"); el.classList.add("bad"); first ||= el; }
    });
    if (first) { first.focus(); first.reportValidity(); return false; }
    return true;
  }

  async function submitOrder(e) {
    e.preventDefault();
    if (!validate(e.target)) return;
    const buyer = Object.fromEntries(new FormData(e.target));
    buyer.store = `${buyer.storeName}（店號 ${buyer.storeId}）`;
    try { localStorage.setItem("yoto-buyer", JSON.stringify({ ...buyer, note: "" })); } catch {}
    const t = totals();
    const orderNo = "Y" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + Math.random().toString(36).slice(2, 6).toUpperCase();
    const text = [
      `【${S.name} 訂單 ${orderNo}】`,
      `姓名：${buyer.name}`, `手機：${buyer.phone}`, `LINE：${buyer.line}`, `Email：${buyer.email}`, `7-11 門市：${buyer.store}`,
      buyer.note ? `備註：${buyer.note}` : null,
      "", "— 商品 —",
      ...cart.map((l) => `・${l.title}${l.variant ? `（${l.variant}）` : ""} × ${l.qty}　${ntd(l.now * l.qty)}`),
      "", `合計：${ntd(t.total)}`, `訂金（${S.depositRate * 100}%）：${ntd(t.deposit)}`, `尾款：${ntd(t.rest)}`,
    ].filter((x) => x !== null).join("\n");

    if (S.orderWebhookUrl) {
      let res;
      try {
        res = await fetch(S.orderWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNo, ...buyer, items: cart, ...t, text }),
        });
      } catch {
        toast("訂單沒有送出，請檢查網路後再試");
        return;
      }
      if (!res.ok) {
        let msg = "訂單沒有送出，請稍後再試";
        try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
        toast(msg);
        return;
      }
    }

    const b = S.bank;
    $("#drawerTitle").textContent = "訂單已建立 🎉";
    $("#drawerBody").innerHTML = `
      <p>訂單編號 <b>${orderNo}</b>。請匯款訂金 <b style="color:var(--sale)">${ntd(t.deposit)}</b>，匯款後請將<b>匯款帳號末五碼</b>與下方訂單內容傳到 LINE 官方帳號，確認後立即向美國官網下單。</p>
      <div class="bank">${esc(b.name)}（${esc(b.code)}）<br>帳號：<b>${esc(b.account)}</b><br>戶名：${esc(b.holder)}</div>
      ${lineBoxHtml()}
      <p style="margin-bottom:6px"><b>訂單內容</b></p>
      <textarea class="order-text" id="orderText" readonly>${esc(text)}</textarea>`;
    $("#drawerFoot").innerHTML = `<button class="btn btn-dark" id="copyOrder">複製訂單內容</button>
      <a class="btn btn-sale" target="_blank" rel="noopener" href="${lineUrl}">加 LINE 官方帳號傳送訂單</a>`;
    $("#copyLineId").onclick = async () => {
      try { await navigator.clipboard.writeText(S.lineId); toast("已複製 LINE ID：" + S.lineId); } catch { toast("LINE ID：" + S.lineId); }
    };
    $("#copyOrder").onclick = async () => {
      try { await navigator.clipboard.writeText(text); } catch { $("#orderText").select(); document.execCommand("copy"); }
      toast("已複製訂單內容");
    };
    cart = []; save();
  }

  function openDrawer() { showCart(); $("#drawer").classList.add("open"); $("#scrim").hidden = false; }
  function closeDrawer() { $("#drawer").classList.remove("open"); $("#scrim").hidden = true; }
  $("#cartOpen").onclick = openDrawer;
  $("#cartClose").onclick = closeDrawer;
  $("#scrim").onclick = closeDrawer;
  $("#drawer").addEventListener("click", (e) => {
    const q = e.target.closest("[data-q]");
    if (q) {
      const l = cart[q.dataset.q];
      l.qty += Number(q.dataset.d);
      if (l.qty <= 0) cart.splice(q.dataset.q, 1);
      save(); showCart();
    }
    if (e.target.id === "goCheckout") showCheckout();
    if (e.target.id === "backCart") showCart();
  });

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  // ---------- 啟動 ----------
  // 官網分類順序：上線後走 Netlify function（自動更新），本機或失敗時用 data/collections.json
  async function loadCollections() {
    for (const url of ["/.netlify/functions/collections", "data/collections.json"]) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const { collections } = await r.json();
        if (!collections?.["best-sellers"]?.length) continue;
        Object.entries(collections).forEach(([slug, list]) => {
          colls[slug] = new Set(list);
          if (slug === "best-sellers") list.forEach((h, i) => (bestRank[h] = i));
          else list.forEach((h, i) => { if (!(h in trendRank) || i < trendRank[h]) trendRank[h] = i; });
        });
        return;
      } catch {}
    }
  }

  updateCount();
  Promise.all([fetchAll(), loadCollections()])
    .then(([raw]) => {
      products = raw.map(normalize).filter(Boolean).concat(thirdParty());
      refreshCartPrices();
      renderFeatured();
      renderTicker();
      render();
    })
    .catch((err) => {
      console.error(err);
      $("#status").textContent = "無法連線美國官網，請稍後重新整理。";
    });
})();
