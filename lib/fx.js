const SOURCE = "https://www.esunbank.com/zh-tw/personal/deposit/rate/forex/foreign-exchange-rates";
const TTL = 5 * 60 * 1000;

let cached = null;
let inflight = null;

function parseUsdSpotSell(html) {
  const blocks = String(html).matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g);
  for (const block of blocks) {
    let data;
    try {
      data = JSON.parse(block[1]);
    } catch {
      continue;
    }
    const items = data?.mainEntity?.itemListElement;
    if (!Array.isArray(items)) continue;
    const hit = items.find((item) => item?.currency === "USD" && item?.name === "美元 即期匯率 銀行賣出");
    const text = String(hit?.currentExchangeRate?.price ?? "").trim();
    if (!/^\d{1,3}(\.\d{1,4})?$/.test(text)) continue;
    const rate = Number(text);
    if (rate < 15 || rate > 80) continue;
    return { rate, display: text, asOf: String(hit.currentExchangeRate.validFrom || "") };
  }
  return null;
}

async function fetchUsdSpotSell() {
  if (cached && Date.now() - cached.fetchedAt < TTL) return cached;
  if (inflight) return inflight;
  inflight = loadQuote().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function loadQuote() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(SOURCE, {
      headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error("fx http");
    const parsed = parseUsdSpotSell(await res.text());
    if (!parsed) throw new Error("fx parse");
    cached = { ...parsed, fetchedAt: Date.now() };
    return cached;
  } catch (error) {
    if (cached) return cached;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { parseUsdSpotSell, fetchUsdSpotSell, SOURCE };
