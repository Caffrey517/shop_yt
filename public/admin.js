(() => {
  const S = window.SHOP;
  const KEY_STORE = "yoto-admin-key";
  const STATUSES = ["待匯訂金", "已收訂金", "已向官網下單", "已抵台", "已寄出", "已完成", "已取消"];
  const ST_COLOR = {
    "待匯訂金": ["#fff3c4", "#7a5b00"], "已收訂金": ["#dcecff", "#1d4f91"], "已向官網下單": ["#ece4ff", "#5a3db0"],
    "已抵台": ["#d9f3ee", "#1f6f61"], "已寄出": ["#e3e5ef", "#1d2340"], "已完成": ["#dff5dc", "#2d6b26"], "已取消": ["#fde2de", "#a3271a"],
  };
  // 這些狀態的訂單要算進「美國官網採購清單」
  const BUY_STATUSES = ["已收訂金"];

  const $ = (s, el = document) => el.querySelector(s);
  const ntd = (n) => "NT$" + Math.round(n).toLocaleString("en-US");
  const usd = (n) => "$" + Number(n).toFixed(2);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtTime = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

  let orders = [];
  let demo = false;
  const ui = { view: "orders", status: "", q: "", open: new Set() };

  $("#title").textContent = S.name + "・訂單後台";

  // ---------- 示範資料 ----------
  function demoOrders() {
    const P = (group, usdNow, usdWas) => {
      const r = S.pricing[group];
      const f = (u) => Math.round(u * r.rate + r.plus);
      return { usd: usdNow, now: f(usdNow), was: usdWas ? f(usdWas) : null };
    };
    const I = {
      mini: { handle: "yoto-mini-player-2024", title: "Yoto Mini (2024 Edition)", ...P("device", 59.99, 79.99) },
      player: { handle: "yoto-player-3rd-generation-thailand", title: "Yoto Player (3rd Generation)", ...P("device", 82.49, 109.99) },
      bluey: { handle: "bluey-the-beach-and-other-stories-na", title: "Bluey: The Beach and Other Stories", ...P("card", 12.99) },
      tiger: { handle: "daniel-tiger-s-neighborhood-5-minute-stories", title: "Daniel Tiger’s Neighborhood 5-Minute Stories", ...P("card", 12.99) },
      zoo: { handle: "dear-zoo", title: "Dear Zoo", ...P("card", 5.99) },
      cardcase: { handle: "card-case", title: "Card Case", variant: "Blue", ...P("device", 22.49, 29.99) },
      phones: { handle: "wireless-headphones", title: "Wireless Headphones", ...P("device", 33.74, 44.99) },
      spooky: { handle: "super-spooky-songs", title: "Super Spooky Songs", ...P("card", 9.99) },
      preschool: { handle: "pre-school-songs-pack", title: "Pre-School Songs Pack", ...P("card", 15.99, 19.99) },
    };
    const mk = (i, day, hh, status, last5, buyer, lines, note = "", adminNote = "") => {
      const items = lines.map(([k, qty]) => ({ ...I[k], qty }));
      const total = items.reduce((s, l) => s + l.now * l.qty, 0);
      const deposit = Math.ceil(total * S.depositRate);
      return {
        orderNo: `Y2610${String(day).padStart(2, "0")}${["K3FA", "M8QZ", "P2LD", "R7XW", "T4NB", "V9HC", "W1JE", "X6GS"][i]}`,
        createdAt: new Date(2026, 9, day, hh, (i * 17) % 60).toISOString(),
        status, last5, ...buyer, note, adminNote, items, total, deposit, rest: total - deposit,
      };
    };
    const B = (name, line, store) => ({ name, phone: "0900-000-00" + name.length, line, email: line + "@example.com", store });
    return [
      mk(0, 8, 21, "待匯訂金", "", B("陳怡君（示範）", "demo_yijun", "7-11 示範門市 A"), [["mini", 1], ["bluey", 2]], "想要橘色"),
      mk(1, 8, 14, "待匯訂金", "", B("林佩珊（示範）", "demo_peishan", "7-11 示範門市 B"), [["zoo", 1], ["tiger", 1], ["preschool", 1]]),
      mk(2, 7, 22, "已收訂金", "48213", B("張雅婷（示範）", "demo_yating", "7-11 示範門市 C"), [["mini", 2], ["cardcase", 1]], "", "雙胞胎各一台"),
      mk(3, 7, 10, "已收訂金", "90577", B("王志明（示範）", "demo_zhiming", "7-11 示範門市 D"), [["player", 1], ["spooky", 1], ["bluey", 1]]),
      mk(4, 6, 19, "已收訂金", "31046", B("黃淑芬（示範）", "demo_shufen", "7-11 示範門市 E"), [["mini", 1], ["phones", 1], ["zoo", 2]]),
      mk(5, 3, 20, "已向官網下單", "77120", B("李佳穎（示範）", "demo_jiaying", "7-11 示範門市 F"), [["tiger", 2], ["preschool", 1]], "", "US 訂單 #100231"),
      mk(6, 2, 9, "已抵台", "60985", B("吳宗翰（示範）", "demo_zonghan", "7-11 示範門市 G"), [["player", 1]]),
      mk(7, 1, 16, "已完成", "13579", B("蔡依玲（示範）", "demo_yiling", "7-11 示範門市 H"), [["mini", 1], ["bluey", 1], ["spooky", 1]]),
    ];
  }

  // ---------- 資料讀寫 ----------
  async function loadOrders(key) {
    let res, j;
    try { res = await fetch(`${S.orderWebhookUrl}?key=${encodeURIComponent(key)}`); }
    catch { throw new Error("連不上訂單後台，請檢查網路後再試一次"); }
    const body = await res.text();
    try { j = JSON.parse(body); }
    catch {
      // Google 的錯誤頁是 HTML，把裡面的錯誤訊息抓出來顯示，方便判斷原因
      const txt = new DOMParser().parseFromString(body, "text/html").body.textContent.replace(/\s+/g, " ").trim();
      const hit = txt.match(/[A-Za-z]*(Error|Exception)[^。]{0,200}/) || txt.match(/.{0,200}/);
      throw new Error("訂單後台回傳錯誤：" + (hit ? hit[0] : "（無內容）"));
    }
    if (!j.ok) throw new Error(j.error === "unauthorized" ? "密碼不正確（大小寫、空白都要完全相同）" : j.error || "讀取失敗");
    return j.orders.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function saveField(o, patch) {
    Object.assign(o, patch);
    if (demo) return toastish("（示範模式：變更不會儲存）");
    try {
      const res = await fetch(S.orderWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", key: sessionStorage.getItem(KEY_STORE), orderNo: o.orderNo, ...patch }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "儲存失敗");
      }
    } catch { alert("儲存失敗，請檢查網路"); }
  }

  // ---------- 登入 ----------
  function showLogin(err = "") {
    $("#topActions").hidden = true;
    $("#mode").hidden = true;
    $("#app").innerHTML = `<div class="login">
      <h2>登入後台</h2>
      <p>${S.orderWebhookUrl ? "請輸入後台密碼（本機預設見 README 的 ADMIN_KEY）。" : "尚未設定訂單紀錄（config.js 的 orderWebhookUrl），目前只能看示範資料。"}</p>
      ${S.orderWebhookUrl ? `<form id="loginForm">
        <input type="text" name="username" value="admin" autocomplete="username" hidden>
        <input type="password" id="key" name="password" placeholder="後台密碼" autocomplete="current-password" required>
        <button class="btn btn-dark" id="go" type="submit">登入</button>
      </form>` : ""}
      <p class="err">${esc(err)}</p>
      <p class="demo-link"><a href="#" id="demo">或先看示範資料 →</a></p>
    </div>`;
    $("#demo").onclick = (e) => { e.preventDefault(); start(null, true); };
    if ($("#loginForm")) {
      $("#key").focus();
      $("#loginForm").onsubmit = (e) => {
        e.preventDefault();
        const key = $("#key").value.trim();
        if (!key) { $(".login .err").textContent = "請輸入後台密碼"; $("#key").focus(); return; }
        start(key);
      };
    }
  }

  // 網址上的 ?demo 只用來「直接看示範」；改用密碼登入時要拿掉，否則重新整理又會回到示範
  function setDemoUrl(on) {
    const u = new URL(location.href);
    on ? u.searchParams.set("demo", "") : u.searchParams.delete("demo");
    history.replaceState(null, "", u.pathname + (u.searchParams.toString() ? "?" + u.searchParams.toString().replace(/=$/, "").replace(/=&/g, "&") : ""));
  }

  // 只有明確要求（按示範連結或網址帶 ?demo）才進入示範；沒有密碼時一律回登入頁
  async function start(key, wantDemo = false) {
    if (!key && !wantDemo) return showLogin(S.orderWebhookUrl ? "" : "尚未設定訂單紀錄");
    demo = wantDemo;
    setDemoUrl(demo);
    if (demo) {
      orders = demoOrders();
    } else {
      $("#app").innerHTML = `<p class="status">讀取訂單中…</p>`;
      try { orders = await loadOrders(key); sessionStorage.setItem(KEY_STORE, key); }
      catch (e) { sessionStorage.removeItem(KEY_STORE); return showLogin("登入失敗：" + e.message); }
      if (!orders.length) toastish("登入成功，目前還沒有訂單");
    }
    $("#mode").hidden = !demo;
    $("#logout").textContent = demo ? "離開示範" : "登出";
    $("#topActions").hidden = false;
    render();
  }

  $("#logout").onclick = () => { sessionStorage.removeItem(KEY_STORE); setDemoUrl(false); showLogin(); };
  $("#reload").onclick = () => start(demo ? null : sessionStorage.getItem(KEY_STORE), demo);

  // ---------- 畫面 ----------
  function kpis() {
    const live = orders.filter((o) => o.status !== "已取消");
    const paid = live.filter((o) => o.status !== "待匯訂金");
    const sum = (arr, k) => arr.reduce((s, o) => s + Number(o[k] || 0), 0);
    const unpaid = live.filter((o) => o.status === "待匯訂金");
    return `<div class="kpis">
      <div class="kpi"><small>有效訂單</small><b>${live.length}</b> 筆</div>
      <div class="kpi"><small>訂單總額</small><b>${ntd(sum(live, "total"))}</b></div>
      <div class="kpi hl"><small>待收訂金（${unpaid.length} 筆）</small><b>${ntd(sum(unpaid, "deposit"))}</b></div>
      <div class="kpi"><small>已收訂金／待收尾款</small><b>${ntd(sum(paid, "deposit"))}</b> / ${ntd(sum(paid.filter((o) => o.status !== "已完成"), "rest"))}</div>
    </div>`;
  }

  function stBadge(s) { const [bg, fg] = ST_COLOR[s] || ["#eee", "#333"]; return `<span class="st" style="background:${bg};color:${fg}">${esc(s)}</span>`; }

  function filteredOrders() {
    const q = ui.q.toLowerCase();
    return orders.filter((o) =>
      (!ui.status || o.status === ui.status) &&
      (!q || [o.orderNo, o.name, o.phone, o.line, o.email, o.last5].join(" ").toLowerCase().includes(q)));
  }

  function ordersView() {
    const counts = Object.fromEntries(STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length]));
    const list = filteredOrders();
    return `<div class="bar">
        <div class="chips">
          <button data-st="" class="${ui.status ? "" : "on"}">全部<em>${orders.length}</em></button>
          ${STATUSES.map((s) => `<button data-st="${s}" class="${ui.status === s ? "on" : ""}">${s}<em>${counts[s]}</em></button>`).join("")}
        </div>
        <input id="q" type="search" placeholder="搜尋 姓名／電話／LINE／末五碼" value="${esc(ui.q)}">
        <button class="btn" id="csv">匯出 CSV</button>
      </div>
      <div class="tbl">
        <div class="row head"><span>訂單編號</span><span>時間</span><span>客人</span><span class="num">合計</span><span class="num">訂金</span><span>匯款末五碼</span><span>狀態</span><span></span></div>
        ${list.length ? list.map(orderRow).join("") : `<p class="empty">沒有符合的訂單</p>`}
      </div>`;
  }

  function orderRow(o) {
    const open = ui.open.has(o.orderNo);
    return `<div class="row ${open ? "open" : ""}" data-no="${esc(o.orderNo)}">
        <span class="no">${esc(o.orderNo)}</span>
        <span>${fmtTime(o.createdAt)}</span>
        <span class="who"><b>${esc(o.name)}</b><small>LINE ${esc(o.line)}・${o.items.reduce((s, l) => s + l.qty, 0)} 件</small></span>
        <span class="num">${ntd(o.total)}</span>
        <span class="num">${ntd(o.deposit)}</span>
        <span><input data-f="last5" maxlength="5" inputmode="numeric" placeholder="—" value="${esc(o.last5)}"></span>
        <span><select data-f="status" style="background:${(ST_COLOR[o.status] || ["#fff"])[0]}">${STATUSES.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select></span>
        <span class="caret">›</span>
      </div>
      <div class="detail ${open ? "show" : ""}" data-detail="${esc(o.orderNo)}">
        <div>
          <h5>商品</h5>
          <table class="items">${o.items.map((l) => `<tr>
            <td>${esc(l.title)}${l.variant ? `（${esc(l.variant)}）` : ""}</td><td>× ${l.qty}</td>
            <td>${usd(l.usd * l.qty)}</td><td>${ntd(l.now * l.qty)}</td></tr>`).join("")}
            <tr><td><b>合計</b></td><td></td><td>${usd(o.items.reduce((s, l) => s + l.usd * l.qty, 0))}</td><td><b>${ntd(o.total)}</b></td></tr>
          </table>
          <p style="font-size:13px;margin:8px 0 0">訂金 <b>${ntd(o.deposit)}</b>・尾款 <b>${ntd(o.rest)}</b></p>
        </div>
        <div class="info">
          <h5>客人資料</h5>
          <dl>
            <dt>手機</dt><dd>${esc(o.phone)}</dd>
            <dt>Email</dt><dd>${esc(o.email)}</dd>
            <dt>LINE</dt><dd>${esc(o.line)}</dd>
            <dt>7-11 門市</dt><dd>${esc(o.store)}</dd>
            ${o.note ? `<dt>客人備註</dt><dd>${esc(o.note)}</dd>` : ""}
          </dl>
          <h5>內部備註</h5>
          <textarea data-f="adminNote" rows="2" placeholder="例如：US 訂單編號、追蹤碼">${esc(o.adminNote)}</textarea>
          <div class="acts"><button class="btn" data-copy>複製訂單文字</button></div>
        </div>
      </div>`;
  }

  // 已收訂金的訂單 → 合併成要在美國官網下單的清單
  function buyView() {
    const src = orders.filter((o) => BUY_STATUSES.includes(o.status));
    const map = new Map();
    src.forEach((o) => o.items.forEach((l) => {
      const k = l.handle + "|" + (l.variant || "");
      const m = map.get(k) || { ...l, qty: 0, from: [] };
      m.qty += l.qty; m.from.push(o.name.replace(/（示範）/, ""));
      map.set(k, m);
    }));
    const rows = [...map.values()].sort((a, b) => b.usd * b.qty - a.usd * a.qty);
    const totalUsd = rows.reduce((s, r) => s + r.usd * r.qty, 0);
    return `<p class="buy-note">狀態為「${BUY_STATUSES.join("、")}」的 ${src.length} 筆訂單，合併後要在美國官網購買的商品。下單後記得把這些訂單改成「已向官網下單」。</p>
      <div class="tbl buy">
        <div class="row head"><span></span><span>商品</span><span class="num">數量</span><span class="num">單價</span><span class="num">小計 (USD)</span><span>官網</span></div>
        ${rows.length ? rows.map((r) => `<div class="row">
          <img src="${esc(imgs[r.handle] || "")}" alt="">
          <span class="who"><b>${esc(r.title)}${r.variant ? `（${esc(r.variant)}）` : ""}</b><small>${esc(r.from.join("、"))}</small></span>
          <span class="num"><b>${r.qty}</b></span>
          <span class="num">${usd(r.usd)}</span>
          <span class="num">${usd(r.usd * r.qty)}</span>
          <span><a href="https://us.yotoplay.com/products/${encodeURIComponent(r.handle)}" target="_blank" rel="noopener">開啟 ↗</a></span>
        </div>`).join("") + `<div class="row"><span></span><span class="total">總計</span><span class="num total">${rows.reduce((s, r) => s + r.qty, 0)}</span><span></span><span class="num total">${usd(totalUsd)}</span><span></span></div>`
        : `<p class="empty">目前沒有待採購的訂單</p>`}
      </div>`;
  }

  // 採購清單的商品圖：從官網抓一次
  const imgs = {};
  let imgsLoaded = false;
  async function loadImgs() {
    if (imgsLoaded) return; imgsLoaded = true;
    try {
      for (let p = 1; p < 20; p++) {
        const { products } = await fetch(`https://us.yotoplay.com/products.json?limit=250&page=${p}`).then((r) => r.json());
        if (!products.length) break;
        products.forEach((x) => { if (x.images[0]) imgs[x.handle] = x.images[0].src + "&width=120"; });
      }
      if (ui.view === "buy") render();
    } catch {}
  }

  function render() {
    $("#app").innerHTML = kpis() + `<div class="views">
        <button data-view="orders" class="${ui.view === "orders" ? "on" : ""}">訂單列表</button>
        <button data-view="buy" class="${ui.view === "buy" ? "on" : ""}">美國官網採購清單</button>
      </div>` + (ui.view === "orders" ? ordersView() : buyView());
    if (ui.view === "buy") loadImgs();
  }

  // ---------- 互動 ----------
  const app = $("#app");
  app.addEventListener("click", (e) => {
    const v = e.target.closest("[data-view]"); if (v) { ui.view = v.dataset.view; return render(); }
    const st = e.target.closest("[data-st]"); if (st) { ui.status = st.dataset.st; return render(); }
    if (e.target.id === "csv") return exportCsv();
    const cp = e.target.closest("[data-copy]");
    if (cp) {
      const o = orders.find((x) => x.orderNo === cp.closest("[data-detail]").dataset.detail);
      navigator.clipboard.writeText(o.text || orderText(o)).then(() => toastish("已複製"));
      return;
    }
    const row = e.target.closest(".row[data-no]");
    if (row && !e.target.closest("input,select")) {
      const no = row.dataset.no;
      ui.open.has(no) ? ui.open.delete(no) : ui.open.add(no);
      row.classList.toggle("open");
      app.querySelector(`[data-detail="${CSS.escape(no)}"]`).classList.toggle("show");
    }
  });
  app.addEventListener("change", (e) => {
    const f = e.target.dataset.f; if (!f) return;
    const no = e.target.closest("[data-no]")?.dataset.no || e.target.closest("[data-detail]")?.dataset.detail;
    const o = orders.find((x) => x.orderNo === no);
    saveField(o, { [f]: e.target.value.trim() });
    if (f === "status") render();
  });
  let qT;
  app.addEventListener("input", (e) => {
    if (e.target.id !== "q") return;
    clearTimeout(qT);
    qT = setTimeout(() => { ui.q = e.target.value; render(); const q = $("#q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250);
  });

  function orderText(o) {
    return [`【${S.name} 訂單 ${o.orderNo}】`, `姓名：${o.name}`, `手機：${o.phone}`, `LINE：${o.line}`, `7-11 門市：${o.store}`, "",
      ...o.items.map((l) => `・${l.title}${l.variant ? `（${l.variant}）` : ""} × ${l.qty}　${ntd(l.now * l.qty)}`), "",
      `合計：${ntd(o.total)}`, `訂金：${ntd(o.deposit)}`, `尾款：${ntd(o.rest)}`].join("\n");
  }

  function exportCsv() {
    const head = ["訂單編號", "時間", "狀態", "末五碼", "姓名", "手機", "LINE", "Email", "門市", "商品", "合計", "訂金", "尾款", "客人備註", "內部備註"];
    const rows = filteredOrders().map((o) => [o.orderNo, fmtTime(o.createdAt), o.status, o.last5, o.name, o.phone, o.line, o.email, o.store,
      o.items.map((l) => `${l.title}${l.variant ? `(${l.variant})` : ""} x${l.qty}`).join("; "), o.total, o.deposit, o.rest, o.note, o.adminNote]);
    const csv = "﻿" + [head, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  function toastish(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 1600);
  }

  // ---------- 啟動 ----------
  const saved = sessionStorage.getItem(KEY_STORE);
  if (saved && S.orderWebhookUrl) start(saved);
  else if (new URLSearchParams(location.search).has("demo")) start(null, true);
  else showLogin();
})();
