const assert = require("node:assert/strict");
const test = require("node:test");
const { splitOrderLists } = require("../public/order-lists");

const player = {
  orderNo: "Y100",
  status: "已收訂金",
  items: [
    { handle: "mini", title: "Yoto Mini", variant: "", cat: "player", qty: 1, now: 2000, usd: 50 },
    { handle: "card", title: "Bluey", variant: "", cat: "single", qty: 2, now: 400, usd: 10 },
  ],
};
const combo = {
  orderNo: "Y200",
  status: "已收訂金",
  items: [{ handle: "set", title: "Mini Set", variant: "Blue", cat: "combo", qty: 1, now: 3000, usd: 80 }],
};
const cards = {
  orderNo: "Y300",
  status: "已收訂金",
  items: [{ handle: "card", title: "Bluey", variant: "", cat: "single", qty: 3, now: 400, usd: 10 }],
};
const waiting = {
  orderNo: "Y400",
  status: "待匯訂金",
  items: [{ handle: "card", title: "Bluey", variant: "", cat: "single", qty: 9, now: 400, usd: 10 }],
};

test("player and combo orders stay in their own columns", () => {
  const lists = splitOrderLists([player, combo, cards, waiting]);
  assert.deepEqual(lists.withPlayer.orders.map((order) => order.orderNo), ["Y100", "Y200"]);
  const mini = lists.withPlayer.products.find((row) => row.title === "Yoto Mini");
  assert.equal(mini.cells.Y100.qty, 1);
  assert.equal(mini.cells.Y100.twd, 2000);
  assert.equal(mini.cells.Y100.usd, 50);
  assert.equal(mini.cells.Y200, undefined);
  const set = lists.withPlayer.products.find((row) => row.title === "Mini Set");
  assert.equal(set.cells.Y200.qty, 1);
  assert.equal(set.cells.Y200.twd, 3000);
});

test("orders without a player export by order and by product", () => {
  const lists = splitOrderLists([player, combo, cards, waiting]);
  assert.deepEqual(lists.withoutByOrder.orders.map((order) => order.orderNo), ["Y300"]);
  const byOrder = lists.withoutByOrder.products[0];
  assert.equal(byOrder.cells.Y300.qty, 3);
  assert.equal(byOrder.cells.Y300.twd, 1200);
  assert.equal(lists.withoutByProduct.length, 1);
  assert.equal(lists.withoutByProduct[0].title, "Bluey");
  assert.equal(lists.withoutByProduct[0].qty, 3);
  assert.equal(lists.withoutByProduct[0].usd, 30);
});
