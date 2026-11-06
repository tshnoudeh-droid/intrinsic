/**
 * Deterministic sanity check for the valuation engine.
 *
 *   npx tsx scripts/check-valuation.ts          # fixture (Yahoo data captured 2026-11-05)
 *   npx tsx scripts/check-valuation.ts --live   # same checks on live Yahoo data
 *
 * Asserts, per ticker:
 *  - margin of safety is (intrinsic − price) / intrinsic, so never above 100%
 *  - intrinsic passes the shared sanity bound (≤ 3× P/E-implied value)
 *  - default growth is ≤ MAX_DEFAULT_PROJECTION_GROWTH
 *  - the stock page's live calculation (calculateDCF + sanity check at the
 *    default sliders) equals the server/screener payload
 *  - the fixture run is deterministic (two runs give identical output)
 * plus targeted regressions (dual-class shares, USD filers on the TSX).
 * Exits non-zero on any failure.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { QuoteSummaryResult } from "yahoo-finance2/modules/quoteSummary-iface";

import {
  calculateDCF,
  MAX_DEFAULT_PROJECTION_GROWTH,
  passesIntrinsicSanityCheck,
} from "../lib/calculate-dcf-client";
import { DCF_ASSUMPTIONS } from "../lib/calculate-intrinsic-value";
import {
  marginOfSafetyPercent,
  valuationLabelFromMargin,
} from "../lib/valuation-label";
import {
  buildStockPayloadFromYahooData,
  computeStockPayloadFromYahoo,
  type YahooStockPayload,
} from "../lib/yahoo-stock-payload";

type FixtureTicker = { summary: QuoteSummaryResult; quote: object };
type Fixture = {
  capturedAt: string;
  fxUSDCAD: number;
  tickers: Record<string, FixtureTicker>;
};

const fixture = JSON.parse(
  readFileSync(
    path.join(__dirname, "fixtures", "valuation-sample.json"),
    "utf8",
  ),
) as Fixture;

const failures: string[] = [];
function check(cond: boolean, msg: string) {
  if (!cond) failures.push(msg);
}

function fxFor(t: FixtureTicker): number {
  const fin = (t.summary.financialData as { financialCurrency?: string })
    ?.financialCurrency;
  const cur = (t.quote as { currency?: string }).currency;
  if (!fin || !cur || fin === cur) return 1;
  if (fin === "USD" && cur === "CAD") return fixture.fxUSDCAD;
  if (fin === "CAD" && cur === "USD") return 1 / fixture.fxUSDCAD;
  throw new Error(`no fixture FX for ${fin}->${cur}`);
}

function runFixture(): Map<string, YahooStockPayload | null> {
  const out = new Map<string, YahooStockPayload | null>();
  for (const [symbol, t] of Object.entries(fixture.tickers)) {
    out.set(
      symbol,
      buildStockPayloadFromYahooData(symbol, t.summary, t.quote, fxFor(t)),
    );
  }
  return out;
}

/** What the stock page computes at default slider positions. */
function clientValuation(p: YahooStockPayload) {
  const raw = calculateDCF({
    cashFlow: p.cashFlowUsed,
    sharesOutstanding: p.sharesOutstanding,
    growthRate: p.growthRateUsed,
    discountRate: DCF_ASSUMPTIONS.discountRate,
    terminalGrowthRate: DCF_ASSUMPTIONS.terminalGrowthRate,
  });
  const iv =
    raw !== null && passesIntrinsicSanityCheck(raw, p.sanityReferenceValue)
      ? raw
      : null;
  return { iv, mos: iv !== null ? marginOfSafetyPercent(iv, p.price) : null };
}

function fmt(x: number | null, d = 1): string {
  return x === null ? "—" : x.toFixed(d);
}

function checkPayload(symbol: string, p: YahooStockPayload | null) {
  if (!p) {
    failures.push(`${symbol}: payload null`);
    return;
  }
  check(
    p.growthRateUsed <= MAX_DEFAULT_PROJECTION_GROWTH + 1e-12,
    `${symbol}: growth ${p.growthRateUsed} above guard`,
  );
  if (p.marginOfSafety !== null) {
    check(p.marginOfSafety <= 100, `${symbol}: MoS ${p.marginOfSafety} > 100`);
  }
  if (p.intrinsicValue !== null) {
    check(
      passesIntrinsicSanityCheck(p.intrinsicValue, p.sanityReferenceValue),
      `${symbol}: intrinsic fails sanity bound`,
    );
  }
  const c = clientValuation(p);
  const same =
    (c.iv === null && p.intrinsicValue === null) ||
    (c.iv !== null &&
      p.intrinsicValue !== null &&
      Math.abs(c.iv - p.intrinsicValue) < 1e-9 * Math.max(1, c.iv));
  check(
    same,
    `${symbol}: stock page (${fmt(c.iv)}) != screener (${fmt(p.intrinsicValue)})`,
  );
}

function printTable(rows: Map<string, YahooStockPayload | null>) {
  console.log(
    "symbol".padEnd(9) +
      "price".padStart(10) +
      "intrinsic".padStart(11) +
      "MoS%".padStart(8) +
      "  label".padEnd(14) +
      "growth".padStart(7) +
      "  cash flow / reason",
  );
  for (const [symbol, p] of rows) {
    if (!p) {
      console.log(symbol.padEnd(9) + "  (no data)");
      continue;
    }
    const label =
      p.marginOfSafety !== null ? valuationLabelFromMargin(p.marginOfSafety) : "—";
    console.log(
      symbol.padEnd(9) +
        fmt(p.price, 2).padStart(10) +
        fmt(p.intrinsicValue, 2).padStart(11) +
        fmt(p.marginOfSafety).padStart(8) +
        `  ${label}`.padEnd(14) +
        `${(p.growthRateUsed * 100).toFixed(1)}%`.padStart(7) +
        `  ${p.cashFlowSource ?? "—"}${p.unavailableReason ? ` / ${p.unavailableReason}` : ""}`,
    );
  }
}

async function main() {
  const live = process.argv.includes("--live");
  let rows: Map<string, YahooStockPayload | null>;

  if (live) {
    rows = new Map();
    for (const symbol of Object.keys(fixture.tickers)) {
      rows.set(symbol, await computeStockPayloadFromYahoo(symbol));
    }
  } else {
    rows = runFixture();
    const again = runFixture();
    check(
      JSON.stringify([...rows]) === JSON.stringify([...again]),
      "fixture run is not deterministic",
    );

    // Regression: dual-class share count (BRK-B Class B-only count was 1.41B).
    const brk = rows.get("BRK-B");
    check(
      brk?.sharesOutstanding ===
        (fixture.tickers["BRK-B"].summary.defaultKeyStatistics as {
          impliedSharesOutstanding: number;
        }).impliedSharesOutstanding,
      "BRK-B: should use impliedSharesOutstanding",
    );
    // Regression: USD financials on a CAD listing are converted.
    const shop = rows.get("SHOP.TO");
    const shopFcf = (fixture.tickers["SHOP.TO"].summary.financialData as {
      freeCashflow: number;
    }).freeCashflow;
    check(
      shop?.cashFlowUsed !== undefined &&
        shop.cashFlowUsed !== null &&
        Math.abs(shop.cashFlowUsed - shopFcf * fixture.fxUSDCAD) < 1,
      "SHOP.TO: cash flow should be converted USD -> CAD",
    );
    // Regression: implausible FCF is skipped, not rescaled by 1e6.
    const psky = rows.get("PSKY");
    check(
      psky?.cashFlowSource !== "freeCashflow",
      "PSKY: FCF > 25% of market cap should skip the freeCashflow tier",
    );
  }

  console.log(
    `Valuation check (${live ? "live Yahoo data" : `fixture ${fixture.capturedAt}`}; ` +
      `r=${DCF_ASSUMPTIONS.discountRate}, tg=${DCF_ASSUMPTIONS.terminalGrowthRate})\n`,
  );
  printTable(rows);
  for (const [symbol, p] of rows) checkPayload(symbol, p);

  if (failures.length > 0) {
    console.error(`\nFAILED (${failures.length}):\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }
  console.log("\nAll valuation checks passed.");
}

void main();
