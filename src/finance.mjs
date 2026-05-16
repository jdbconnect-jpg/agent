import { config } from './config.mjs';

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'jepq-video-agent/1.0' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function getFinanceSnapshot() {
  let usdKrw = 1498;
  let etfPriceUsd = null;
  const ticker = config.etfTicker;

  try {
    const fx = await fetchJson('https://open.er-api.com/v6/latest/USD');
    if (fx?.rates?.KRW) usdKrw = fx.rates.KRW;
  } catch {
    // Keep deterministic fallback for offline render previews.
  }

  try {
    const quote = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5d&interval=1d`);
    const result = quote.chart.result[0];
    etfPriceUsd = result.meta.regularMarketPrice || result.indicators.quote[0].close.at(-1);
  } catch {
    // Price is useful for share count, but not required for the principal math.
  }

  const annualYield = config.etfAnnualYield;
  const targetAnnualKrw = config.targetMonthlyKrw * 12;
  const grossPrincipalKrw = targetAnnualKrw / annualYield;
  const netPrincipalKrw = targetAnnualKrw / (annualYield * (1 - config.usWithholdingTaxRate));

  return {
    asOf: new Date().toISOString().slice(0, 10),
    ticker,
    usdKrw,
    etfPriceUsd,
    annualYield,
    targetMonthlyKrw: config.targetMonthlyKrw,
    targetAnnualKrw,
    grossPrincipalKrw,
    netPrincipalKrw,
    taxRate: config.usWithholdingTaxRate,
  };
}

export function formatKrw(value) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}억 원`;
  if (value >= 10_000) return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만 원`;
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}
