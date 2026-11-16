const assert = require("node:assert/strict");
const test = require("node:test");
const { parseUsdSpotSell } = require("../lib/fx");

const page = `<script type="application/ld+json">
{"@type":"WebPage","mainEntity":{"itemListElement":[
  {"@type":"ExchangeRateSpecification","name":"美元 即期匯率 銀行買入","currency":"USD","currentExchangeRate":{"price":"32.89","validFrom":"2026-11-16T14:58:00+08:00"}},
  {"@type":"ExchangeRateSpecification","name":"美元 即期匯率 銀行賣出","currency":"USD","currentExchangeRate":{"price":"32.99","validFrom":"2026-11-16T14:58:00+08:00"}}
]}}
</script>`;

test("the USD spot selling rate is the bank's sell quote", () => {
  const quote = parseUsdSpotSell(page);
  assert.equal(quote.display, "32.99");
  assert.equal(quote.rate, 32.99);
  assert.equal(quote.asOf, "2026-11-16T14:58:00+08:00");
});

test("a page without the USD sell quote is ignored", () => {
  assert.equal(parseUsdSpotSell("<html></html>"), null);
});
