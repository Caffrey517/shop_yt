// 含故事機：播放器或播放器組合。後台與測試共用。
const PLAYER_CATS = new Set(["player", "combo"]);

function itemCat(line, catByHandle) {
  if (line && line.cat) return line.cat;
  if (line && catByHandle && line.handle && catByHandle[line.handle]) return catByHandle[line.handle];
  return "";
}

function hasPlayer(order, catByHandle) {
  return (order.items || []).some((line) => PLAYER_CATS.has(itemCat(line, catByHandle)));
}

function lineKey(line) {
  return [line.handle || line.title || "", line.variant || "", Number(line.now) || 0, Number(line.usd) || 0].join("|");
}

function addCell(cell, line) {
  const qty = Number(line.qty) || 0;
  cell.qty += qty;
  cell.twd += (Number(line.now) || 0) * qty;
  cell.usd += (Number(line.usd) || 0) * qty;
  return cell;
}

// 直欄是訂單編號，每一格有數量與台幣、美金小計。
function columnsByOrder(orders) {
  const list = (orders || []).slice().sort((a, b) => String(a.orderNo).localeCompare(String(b.orderNo)));
  const products = new Map();
  for (const order of list) {
    for (const line of order.items || []) {
      const key = lineKey(line);
      if (!products.has(key)) {
        products.set(key, {
          title: line.title || "",
          variant: line.variant || "",
          cells: {},
        });
      }
      const row = products.get(key);
      row.cells[order.orderNo] = addCell(row.cells[order.orderNo] || { qty: 0, twd: 0, usd: 0 }, line);
    }
  }
  return { orders: list, products: [...products.values()] };
}

// 直欄是商品，每一欄有數量與台幣、美金小計。
function columnsByProduct(orders) {
  const products = new Map();
  for (const order of orders || []) {
    for (const line of order.items || []) {
      const key = lineKey(line);
      const row = products.get(key) || {
        title: line.title || "",
        variant: line.variant || "",
        qty: 0,
        twd: 0,
        usd: 0,
      };
      addCell(row, line);
      products.set(key, row);
    }
  }
  return [...products.values()].sort((a, b) => a.title.localeCompare(b.title, "zh-Hant") || a.variant.localeCompare(b.variant));
}

function splitOrderLists(orders, statuses, catByHandle) {
  const ready = new Set(statuses || ["已收訂金"]);
  const source = (orders || []).filter((order) => ready.has(order.status));
  const withPlayer = source.filter((order) => hasPlayer(order, catByHandle));
  const withoutPlayer = source.filter((order) => !hasPlayer(order, catByHandle));
  return {
    withPlayer: columnsByOrder(withPlayer),
    withoutByOrder: columnsByOrder(withoutPlayer),
    withoutByProduct: columnsByProduct(withoutPlayer),
  };
}

const orderListsApi = { PLAYER_CATS, hasPlayer, columnsByOrder, columnsByProduct, splitOrderLists };
if (typeof module === "object" && module.exports) module.exports = orderListsApi;
