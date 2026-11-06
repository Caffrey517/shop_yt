const express = require("express");
const path = require("path");
const orders = require("./lib/orders");

const app = express();
const publicDir = path.join(__dirname, "public");
const hits = new Map();

app.disable("x-powered-by");
app.set("trust proxy", false);

app.use((req, res, next) => {
  if (req.method !== "POST" || !req.path.startsWith("/api/")) return next();
  const chunks = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > 1_000_000) {
      res.status(413).json({ ok: false, error: "內容太大" });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    if (res.headersSent) return;
    const raw = Buffer.concat(chunks).toString("utf8");
    if (!raw) {
      req.body = {};
      return next();
    }
    try {
      req.body = JSON.parse(raw);
    } catch {
      return res.status(400).json({ ok: false, error: "JSON 格式不正確" });
    }
    return next();
  });
});

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 30) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

app.get("/api/orders", (req, res) => {
  if (!orders.keyOk(req.query.key)) return res.status(401).json({ ok: false, error: "unauthorized" });
  res.json({ ok: true, orders: orders.listOrders() });
});

app.get("/api/buying-list", (req, res) => {
  if (!orders.keyOk(req.query.key)) return res.status(401).json({ ok: false, error: "unauthorized" });
  res.json({ ok: true, ...orders.buyingList() });
});

app.post("/api/orders", (req, res) => {
  const body = req.body || {};
  if (body.action === "update") {
    if (!orders.keyOk(body.key)) return res.status(401).json({ ok: false, error: "unauthorized" });
    const result = orders.updateOrder(String(body.orderNo || ""), body);
    if (result.error) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, order: result.order });
  }
  if (limited(req.ip || "local")) return res.status(429).json({ ok: false, error: "請稍後再試" });
  const result = orders.createOrder(body);
  if (result.error) return res.status(400).json({ ok: false, error: result.error });
  return res.status(201).json({ ok: true, orderNo: result.order.orderNo });
});

app.get(["/admin", "/admin.html"], (_req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

app.get("/.netlify/functions/collections", (_req, res) => {
  res.sendFile(path.join(publicDir, "data", "collections.json"));
});

app.use(express.static(publicDir));

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`shop listening on http://0.0.0.0:${port}`);
  });
}

module.exports = app;
