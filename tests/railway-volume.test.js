const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

test("a Railway volume stores orders.json on the mounted disk", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rail-vol-"));
  const previousOrders = process.env.ORDERS_PATH;
  const previousMount = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  delete process.env.ORDERS_PATH;
  process.env.RAILWAY_VOLUME_MOUNT_PATH = dir;
  const ordersPath = require.resolve("../lib/orders");
  delete require.cache[ordersPath];
  const { ordersFile, createOrder } = require("../lib/orders");
  try {
    assert.equal(ordersFile(), path.join(dir, "orders.json"));
    const created = createOrder({
      orderNo: "Y261108RAIL",
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
        usd: 79.99,
        now: 3200,
        qty: 1,
        img: "https://cdn.shopify.com/s/files/x.jpg",
      }],
      text: "order",
    });
    assert.equal(created.order.orderNo, "Y261108RAIL");
    assert.equal(fs.existsSync(path.join(dir, "orders.json")), true);
  } finally {
    if (previousOrders === undefined) delete process.env.ORDERS_PATH;
    else process.env.ORDERS_PATH = previousOrders;
    if (previousMount === undefined) delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
    else process.env.RAILWAY_VOLUME_MOUNT_PATH = previousMount;
    delete require.cache[ordersPath];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
