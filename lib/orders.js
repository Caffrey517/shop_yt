const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STATUSES = ["待匯訂金", "已收訂金", "已向官網下單", "已抵台", "已寄出", "已完成", "已取消"];
// Matches the admin buying list: only deposits already received are ready to purchase.
const BUY_STATUSES = ["已收訂金"];
const DEPOSIT_RATE = 0.2;

function ordersFile() {
  return process.env.ORDERS_PATH || path.join(__dirname, "..", "data", "orders.json");
}

function readOrders() {
  try {
    const data = JSON.parse(fs.readFileSync(ordersFile(), "utf8"));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function writeOrders(orders) {
  const file = ordersFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(orders, null, 2));
  fs.renameSync(tmp, file);
}

function clip(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function safeImg(src) {
  const value = clip(src, 500);
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function adminKey() {
  return process.env.ADMIN_KEY || "Kk2786949";
}

function keyOk(key) {
  const given = Buffer.from(String(key ?? ""));
  const expected = Buffer.from(adminKey());
  if (given.length === 0 || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(given, expected);
}

function createOrder(body) {
  const name = clip(body.name, 30);
  const phone = clip(body.phone, 20).replace(/\D/g, "");
  const line = clip(body.line, 40);
  const email = clip(body.email, 80);
  const store = clip(body.store, 80);
  const note = clip(body.note, 300);
  const orderNo = clip(body.orderNo, 40);

  if (!name) return { error: "請填寫姓名" };
  if (!/^09\d{8}$/.test(phone)) return { error: "手機格式不正確" };
  if (!line) return { error: "請填寫 LINE ID" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Email 格式不正確" };
  if (!store) return { error: "請填寫門市" };
  if (!/^Y[A-Z0-9]{6,24}$/.test(orderNo)) return { error: "訂單編號不正確" };
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    return { error: "購物車是空的" };
  }

  const items = [];
  for (const raw of body.items) {
    const qty = Number(raw.qty);
    const now = Number(raw.now);
    const usd = Number(raw.usd);
    const was = raw.was == null || raw.was === "" ? null : Number(raw.was);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) return { error: "數量不正確" };
    if (!Number.isFinite(now) || now < 0 || now > 500000) return { error: "價格不正確" };
    if (!Number.isFinite(usd) || usd < 0 || usd > 20000) return { error: "美金價格不正確" };
    if (was != null && (!Number.isFinite(was) || was < 0 || was > 500000)) return { error: "原價不正確" };
    const title = clip(raw.title, 200);
    if (!title) return { error: "商品名稱缺少" };
    items.push({
      id: clip(raw.id, 40),
      handle: clip(raw.handle, 120),
      title,
      variant: clip(raw.variant, 80),
      img: safeImg(raw.img),
      usd,
      now,
      was,
      qty,
    });
  }

  const orders = readOrders();
  if (orders.some((order) => order.orderNo === orderNo)) return { error: "訂單編號重複" };

  const total = items.reduce((sum, line) => sum + line.now * line.qty, 0);
  const deposit = Math.ceil(total * DEPOSIT_RATE);
  const order = {
    orderNo,
    createdAt: new Date().toISOString(),
    status: "待匯訂金",
    last5: "",
    name,
    phone,
    line,
    email,
    store,
    note,
    adminNote: "",
    items,
    total,
    deposit,
    rest: total - deposit,
    text: clip(body.text, 8000),
  };
  orders.push(order);
  writeOrders(orders);
  return { order };
}

function listOrders() {
  return readOrders().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function deleteOrder(orderNo) {
  const orders = readOrders();
  const index = orders.findIndex((item) => item.orderNo === orderNo);
  if (index < 0) return { error: "找不到訂單" };
  const [order] = orders.splice(index, 1);
  writeOrders(orders);
  return { order };
}

function updateOrder(orderNo, patch) {
  const orders = readOrders();
  const order = orders.find((item) => item.orderNo === orderNo);
  if (!order) return { error: "找不到訂單" };
  if (patch.status != null) {
    if (!STATUSES.includes(patch.status)) return { error: "狀態不正確" };
    order.status = patch.status;
  }
  if (patch.last5 != null) order.last5 = String(patch.last5).replace(/\D/g, "").slice(0, 5);
  if (patch.adminNote != null) order.adminNote = clip(patch.adminNote, 500);
  writeOrders(orders);
  return { order };
}

function buyingList(source = listOrders()) {
  const ready = source.filter((order) => BUY_STATUSES.includes(order.status));
  const merged = new Map();
  for (const order of ready) {
    for (const line of order.items) {
      const key = `${line.handle}|${line.variant || ""}`;
      const row = merged.get(key) || {
        handle: line.handle,
        title: line.title,
        variant: line.variant || "",
        usd: line.usd,
        img: line.img,
        qty: 0,
        from: [],
      };
      row.qty += line.qty;
      row.from.push(order.name);
      merged.set(key, row);
    }
  }
  const rows = [...merged.values()].sort((a, b) => b.usd * b.qty - a.usd * a.qty);
  return {
    count: ready.length,
    rows,
    totalQty: rows.reduce((sum, row) => sum + row.qty, 0),
    totalUsd: rows.reduce((sum, row) => sum + row.usd * row.qty, 0),
  };
}

module.exports = {
  STATUSES,
  BUY_STATUSES,
  DEPOSIT_RATE,
  createOrder,
  listOrders,
  updateOrder,
  deleteOrder,
  buyingList,
  keyOk,
};
