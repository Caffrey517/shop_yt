const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const file = path.join(os.tmpdir(), `yoto-orders-${process.pid}.json`);
process.env.ORDERS_PATH = file;
process.env.ADMIN_KEY = "test-key";

const app = require("../server");

let server;
let base;

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(file, { force: true });
});

const sample = {
  orderNo: "Y261106ABCD",
  name: "測試",
  phone: "0912345678",
  line: "tester",
  email: "a@b.co",
  store: "鑫台北（店號 123456）",
  note: "",
  items: [{
    id: "1",
    handle: "yoto-mini-player-2024",
    title: "Yoto Mini",
    variant: "",
    usd: 59.99,
    now: 2400,
    was: 3200,
    qty: 1,
    img: "https://cdn.shopify.com/s/files/x.jpg",
  }],
  text: "order",
};

test("storefront and admin pages are served", async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /全部商品/);
  assert.match(html, /id="how"/);
  assert.match(html, /id="shop"/);
  const admin = await fetch(`${base}/admin`);
  assert.equal(admin.status, 200);
  assert.match(await admin.text(), /訂單後台/);
  const collections = await fetch(`${base}/data/collections.json`);
  assert.equal(collections.status, 200);
  const data = await collections.json();
  assert.ok(data.collections["best-sellers"].length > 0);
});

test("an order is stored and appears on the buying list after the deposit is marked", async () => {
  const denied = await fetch(`${base}/api/orders`);
  assert.equal(denied.status, 401);

  const created = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sample),
  });
  assert.equal(created.status, 201);

  const listed = await fetch(`${base}/api/orders?key=test-key`).then((res) => res.json());
  assert.equal(listed.ok, true);
  assert.equal(listed.orders.length, 1);
  assert.equal(listed.orders[0].status, "待匯訂金");
  assert.equal(listed.orders[0].deposit, 480);

  const emptyList = await fetch(`${base}/api/buying-list?key=test-key`).then((res) => res.json());
  assert.equal(emptyList.count, 0);

  const updated = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "update",
      key: "test-key",
      orderNo: sample.orderNo,
      status: "已收訂金",
      last5: "12-345",
    }),
  });
  assert.equal(updated.status, 200);

  const buying = await fetch(`${base}/api/buying-list?key=test-key`).then((res) => res.json());
  assert.equal(buying.count, 1);
  assert.equal(buying.rows[0].handle, "yoto-mini-player-2024");
  assert.equal(buying.rows[0].qty, 1);
  assert.equal(buying.totalUsd, 59.99);

  const again = await fetch(`${base}/api/orders?key=test-key`).then((res) => res.json());
  assert.equal(again.orders[0].last5, "12345");
  assert.equal(again.orders[0].status, "已收訂金");
});

test("deleting an order removes it from the buying list", async () => {
  const orderNo = "Y261106DEL1";
  const created = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...sample, orderNo }),
  });
  assert.equal(created.status, 201);
  const paid = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "update", key: "test-key", orderNo, status: "已收訂金" }),
  });
  assert.equal(paid.status, 200);

  const denied = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "delete", orderNo }),
  });
  assert.equal(denied.status, 401);

  const removed = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "delete", key: "test-key", orderNo }),
  });
  assert.equal(removed.status, 200);

  const listed = await fetch(`${base}/api/orders?key=test-key`).then((res) => res.json());
  assert.equal(listed.orders.some((order) => order.orderNo === orderNo), false);
  const buying = await fetch(`${base}/api/buying-list?key=test-key`).then((res) => res.json());
  const stillThere = listed.orders.some((order) => order.orderNo === orderNo && order.status === "已收訂金");
  assert.equal(stillThere, false);
  assert.equal(Array.isArray(buying.rows), true);
});

test("bad checkout data is rejected", async () => {
  const res = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...sample, orderNo: "Y261106ZZZZ", phone: "123" }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /手機/);
});
