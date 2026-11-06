# 一本一本 育兒選物

Storefront and order desk rebuilt from the public pages at `https://storybystory-shop.netlify.app/`. Product names, photos, and US-dollar prices are loaded live from the Yoto US catalog. Orders and the US buying list are stored by this app.

## Run

```bash
npm install
npm start
```

Open `http://127.0.0.1:3000/`. The order desk is `http://127.0.0.1:3000/admin`.

The desk password is the `ADMIN_KEY` environment variable. When it is unset, the local default is `story-admin`. Set `ADMIN_KEY` before starting the server if you want a different password. Orders are written to `data/orders.json`.

```bash
ADMIN_KEY=your-password npm start
```

## Pages

| Path | What it shows |
| --- | --- |
| `/` | Shop name, sale ticker, featured players, the five-step buying flow (`#how`), and the catalog (`#shop`) |
| `/admin` | Password login, order list, and the merged US buying list. `?demo` opens sample orders that are not saved |

The catalog is one page. These controls stay on `/`:

- Header jumps: 播放器, 故事卡, 配件, 購買流程 (`#shop` with a category, or `#how`)
- Category tabs: 全部, 特價中, 播放器, 播放器組合, 故事卡, 卡片套組, 原廠配件, 副廠配件
- Age, card type, language, search, and sort
- Cart drawer, checkout form, and the receipt with the bank transfer and LINE account

There is no separate product URL. Each card is rendered in the grid.

## Links on the pages

- Catalog data: `https://us.yotoplay.com/products.json`
- Card-type membership: `/data/collections.json` (same lists the original Netlify function returns)
- LINE friend link and QR code, built from the ID in `public/config.js`
- 7-ELEVEN store map: `https://emap.pcsc.com.tw/`
- On the buying list, each row opens `https://us.yotoplay.com/products/<handle>`

## Pricing

Configured in `public/config.js`:

- Players, bundles, and accessories: USD × 40
- Cards and card packs: USD × 35 + NT$100
- Deposit: 20% of the NT$ total. The rest is due on pickup

## Order desk

1. A shopper checks out. `POST /api/orders` stores the buyer, the 7-ELEVEN store, and each line.
2. Sign in at `/admin` and set the transfer’s last five digits and the status.
3. Orders marked **已收訂金** are merged into **美國官網採購清單**. The same merge is `GET /api/buying-list?key=...`.
4. After you place the US order, change those rows to **已向官網下單** so they leave the list.

`npm test` covers page serving, saving an order, and building the buying list.
