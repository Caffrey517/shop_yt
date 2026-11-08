# kokola 育兒購物

Storefront and order desk for the Yoto proxy shop. Product names, photos, and US-dollar prices load live from the Yoto US catalog. Checkout and the US buying list are saved by this app.

## Run

```bash
npm install
npm start
```

`server.js` listens on `0.0.0.0`. The port is `PORT`, or `3000` when that is unset.

- Shop: `http://127.0.0.1:3000/`
- Order desk: `http://127.0.0.1:3000/admin`

The desk password is the `ADMIN_KEY` environment variable. When it is unset, the server uses the fallback in `lib/orders.js`.

```bash
ADMIN_KEY=your-password npm start
```

Orders are written to `data/orders.json`. `ORDERS_PATH` overrides that file. On Railway, a mounted volume is used instead, because Railway erases the normal disk on every deploy. `npm test` checks page serving, saving an order, and building the buying list.

## Railway

Railway runs this app. It does not have its own screen for customer orders. After the app is deployed, buying history is the order desk on that same address: `https://<your-app>.up.railway.app/admin`.

The GitHub connection deploys the branch you select. `main` only contains this README. The shop is on `cursor/yoto-shop-pages-aaf0`. In the Railway service, set **Settings → Source → Branch** to `cursor/yoto-shop-pages-aaf0`.

Then, in that service:

1. **Variables:** set `ADMIN_KEY` to the desk password. Railway provides `PORT`; do not set it yourself.
2. **Volumes:** add a volume and set its mount path to `/data`. The app stores `orders.json` there.
3. **Networking:** generate a public domain. Open `/` for the shop and `/admin` for the buying history.

A new push to that branch redeploys. Orders on the volume stay. Orders saved before the volume was mounted were on the temporary disk and are gone.

## JavaScript

| File | Role |
| --- | --- |
| `public/config.js` | Shop name, badge, exchange rates, deposit, bank, LINE ID, search shortcuts, featured products, and where orders are posted |
| `public/app.js` | Catalog, cart, checkout, and the receipt. Reads `window.SHOP` |
| `public/admin.js` | Order desk: login, status updates, CSV export, and the merged US buying list |
| `server.js` | Serves the pages and the order API. Listens on `0.0.0.0` |
| `lib/orders.js` | Validates a checkout, stores orders, and builds the buying list. On Railway this file is on the mounted volume |

`public/index.html` is the shop. `public/admin.html` is the desk. Card-type membership is `public/data/collections.json`.

## Settings in `public/config.js`

Day-to-day shop changes belong in this file.

| Setting | Current value |
| --- | --- |
| Name | kokola 育兒購物 |
| Badge | Yoto 秋季特惠 10/12 結單 |
| Players, player bundles, accessories | USD × 40 |
| Story cards and card packs | USD × 35 + NT$100 |
| Deposit | 20% (`depositRate: 0.2`). The rest is due on pickup |
| Bank | 兆豐銀行 (017), account `02210973411`, 吳*群 |
| LINE | `originalfake517` (personal ID, no leading `@`) |
| Orders | `orderWebhookUrl: "/api/orders"` |
| Featured | `yoto-mini-player-2024`, `yoto-mini-4` |
| Quick search | Super Simple Songs, Bluey, Disney, Yoto Originals, Peppa Pig, Make Your Own Card |
| Third-party accessories | `thirdParty` is empty, so 副廠配件 shows 「即將上架」 |

`app.js` prices each product with `pricing` and `typeMap`. A LINE ID that starts with `@` is treated as an official account and gets a QR code. The current ID does not, so the receipt shows a friend link and a copy button only. Leaving `orderWebhookUrl` empty skips saving and only lets the shopper copy the order text.

The stored deposit in `lib/orders.js` is also 20%. Change `depositRate` in `config.js` and `DEPOSIT_RATE` in `lib/orders.js` together.

## Catalog (`public/app.js`)

The shop is one page. There is no separate product page on this site. The product photo on each catalog card, featured item, and cart line opens that product on the Yoto US site: `https://us.yotoplay.com/products/<handle>`. Third-party accessories have no official page, so their photos are not linked.

- Header jumps: 播放器, 故事卡, 配件, and 購買流程 (`#how`)
- Tabs: 全部, 特價中, 播放器, 播放器組合, 故事卡, 卡片套組, 原廠配件, 副廠配件
- Age, card type, language (default 英文商品), search, and sort
- 「載入更多」 shows 40 more items. It hides when none are left, and the remainder does not go below zero

Checkout asks for name, a `09` mobile number, LINE ID, email, and the 7-ELEVEN store name plus 6-digit store number. The map link is `https://emap.pcsc.com.tw/`. The receipt then shows the bank block from `config.js` and the order text.

Catalog data comes from `https://us.yotoplay.com/products.json`. Card groups come from `/.netlify/functions/collections`, which `server.js` serves from `public/data/collections.json`.

## Order desk (`public/admin.js`)

Sign in at `/admin` with the desk password. `?demo`, or the 「示範資料」 link, opens sample orders that are not saved.

Statuses: 待匯訂金, 已收訂金, 已向官網下單, 已抵台, 已寄出, 已完成, 已取消. Each row can store the transfer’s last five digits and an internal note. The list can be exported as CSV, with one row per product so an order with several items is not packed into a single cell. Open a row and choose 刪除訂單 to erase that record from `data/orders.json` and from the buying list. Deletion cannot be undone.

**美國官網採購清單** merges orders whose status is 已收訂金. Each row links to `https://us.yotoplay.com/products/<handle>`. After the US order is placed, change those rows to 已向官網下單 so they leave the list.

| Request | What it does |
| --- | --- |
| `POST /api/orders` | Saves a checkout |
| `GET /api/orders?key=...` | Lists orders. Requires the desk password |
| `POST /api/orders` with `action: "update"` | Updates status, last five digits, or the internal note |
| `GET /api/buying-list?key=...` | Returns the merged 已收訂金 list |
