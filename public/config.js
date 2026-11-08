// =====================================================
//  商店設定 —— 日常只需要改這個檔案
// =====================================================
window.SHOP = {
  name: "kokola 育兒購物",
  badge: "Yoto 秋季特惠 10/12 結單",            // 頁首小標籤，留空 "" 不顯示

  // ---------- 定價規則（固定匯率）----------
  // 售價 = 官網美金價 × rate + plus（四捨五入到整數）
  // 原價（劃線價）用同一公式套在官網的 compare_at_price 上
  pricing: {
    device: { rate: 40, plus: 0 },    // 播放器（Yoto Mini 等）、播放器組合、配件
    card:   { rate: 35, plus: 100 },  // 故事卡、卡片套組
  },
  // 官網 product_type → 套用哪組定價
  typeMap: {
    "player-unit":    "device",
    "content-bundle": "device",   // 播放器 + 卡片組合
    "accessories":    "device",
    "single-card":    "card",
    "bundle":         "card",     // 卡片套組
    "soft-bundle":    "card",
  },

  depositRate: 0.2,               // 訂金比例

  bank: {
    name: "中國信託",
    code: "822",
    account: "082539800171",
    holder: "吳*葶",
  },

  lineId: "@398tfqrx",        // LINE 官方帳號請用 @ 開頭；個人 ID 則不加 @
  // 訂單寫入本站後台。留空則只讓客人複製訂單、不寫入紀錄
  orderWebhookUrl: "/api/orders",

  // ---------- 副廠配件（直接填台幣，不套匯率）----------
  // 範例：
  // {
  //   id: "mini-case-a",                 // 自訂代號（英數，不可重複）
  //   title: "Yoto Mini 矽膠保護套",
  //   brand: "副廠",
  //   price: 390,                        // 售價（台幣）
  //   was: 590,                          // 原價（選填，填了會顯示劃線價）
  //   img: "images/mini-case-a.jpg",     // 圖片：放在 images 資料夾，或貼網址
  //   options: ["粉紅", "天空藍"],         // 款式（選填）
  //   note: "適用 Yoto Mini 2024",        // 一行說明（選填）
  //   inStock: true,
  // },
  thirdParty: [],

  // 搜尋欄下方的「熱門搜尋」按鈕（想換就改這裡）
  // 一般文字 = 搜尋商品名稱；{ label, collection } = 直接帶出官網該分類（collection 為官網 /collections/ 後面那段）
  quickSearch: [
    "Super Simple Songs", "Bluey", "Disney",
    { label: "Yoto Originals", collection: "yoto-originals" },
    "Peppa Pig", "Make Your Own Card",
  ],

  // 首頁「主打」區塊顯示的商品（官網網址 /products/ 後面那段）
  featured: ["yoto-mini-player-2024", "yoto-mini-4"],
};
