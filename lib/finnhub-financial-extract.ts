/**
 * Parse numeric values from Finnhub payloads (numbers may arrive as strings).
 */
export function parseFinnhubNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

type ReportBlock = Record<string, unknown>;

function getLatestAnnualReport(payload: unknown): ReportBlock | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) return null;

  const annual = data.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const q = (row as { quarter?: unknown }).quarter;
    if (q === undefined || q === null) return true;
    if (typeof q === "number" && q >= 1 && q <= 3) return false;
    return true;
  });

  const rows = annual.length > 0 ? annual : data;
  const sorted = [...rows].sort((a, b) => {
    const ya = (a as { year?: unknown }).year;
    const yb = (b as { year?: unknown }).year;
    const na = typeof ya === "number" ? ya : Number(ya);
    const nb = typeof yb === "number" ? yb : Number(yb);
    if (Number.isFinite(nb) && Number.isFinite(na)) return nb - na;
    const da = String((a as { endDate?: unknown }).endDate ?? "");
    const db = String((b as { endDate?: unknown }).endDate ?? "");
    return db.localeCompare(da);
  });

  const filing = sorted[0];
  if (!filing || typeof filing !== "object") return null;
  const report = (filing as { report?: unknown }).report;
  if (!report || typeof report !== "object") return null;
  return report as ReportBlock;
}

/**
 * Find first line in a statement section whose `concept` contains one of the substrings (order matters).
 */
function findValueByConceptHints(section: unknown, hints: string[]): number | null {
  if (!Array.isArray(section)) return null;
  for (const hint of hints) {
    const needle = hint.toLowerCase();
    for (const row of section) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const concept = String(o.concept ?? "").toLowerCase();
      if (!concept.includes(needle)) continue;
      const v = parseFinnhubNumber(o.value ?? o.v ?? o.amount);
      if (v !== null) return v;
    }
  }
  return null;
}

/**
 * Operating cash flow and capital expenditures from latest annual `financials-reported` filing (`report.cf`).
 * Hints follow Finnhub/US-GAAP concept ids (e.g. ...CashFlowFromOperatingActivities, ...CapitalExpenditures).
 */
export function extractOperatingCashFlowAndCapExFromReported(
  payload: unknown,
): { operatingCashFlow: number | null; capitalExpenditures: number | null } {
  const report = getLatestAnnualReport(payload);
  if (!report) {
    return { operatingCashFlow: null, capitalExpenditures: null };
  }
  const cf = report.cf;
  const operatingCashFlow = findValueByConceptHints(cf, [
    "cashflowfromoperatingactivities",
    "netcashprovidedbyusedinoperatingactivities",
  ]);
  const capitalExpenditures = findValueByConceptHints(cf, [
    "capitalexpenditures",
    "paymentstoacquirepropertyplantandequipment",
  ]);
  return { operatingCashFlow, capitalExpenditures };
}

/**
 * FCF = operating cash flow − capital expenditures (per filing line items).
 * Returns null if either input is missing.
 */
export function computeFcfFromOperatingAndCapEx(
  operatingCashFlow: number | null,
  capitalExpenditures: number | null,
): number | null {
  if (operatingCashFlow === null || capitalExpenditures === null) return null;
  if (!Number.isFinite(operatingCashFlow) || !Number.isFinite(capitalExpenditures)) {
    return null;
  }
  const fcf = operatingCashFlow - capitalExpenditures;
  return Number.isFinite(fcf) ? fcf : null;
}

/**
 * Net income from latest annual income statement (`report.ic`), excluding per-share / EPS lines.
 */
export function extractNetIncomeFromFinancialsReported(payload: unknown): number | null {
  const report = getLatestAnnualReport(payload);
  if (!report) return null;
  const ic = report.ic;
  if (!Array.isArray(ic)) return null;

  for (const row of ic) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const concept = String(o.concept ?? "").toLowerCase();
    if (!concept.includes("netincome")) continue;
    if (/pershare|eps|dilutedeps|basiceps|subtotal/i.test(concept)) continue;
    const v = parseFinnhubNumber(o.value ?? o.v ?? o.amount);
    if (v !== null) return v;
  }
  return null;
}

function getMetricMap(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const m = (payload as { metric?: unknown }).metric;
  if (!m || typeof m !== "object") return null;
  return m as Record<string, unknown>;
}

/**
 * Finnhub `metric` share fields are inconsistent: sometimes millions, sometimes full count.
 * Values ≥ 1e8 are treated as already a full share count; smaller values are × 1M (millions).
 */
function sharesFromMetricMillionsOrFull(raw: number | null): number | null {
  if (raw === null || !Number.isFinite(raw) || raw <= 0) return null;
  if (raw >= 1e8) return raw;
  return raw * 1_000_000;
}

/**
 * Try A → B → C on `/stock/metric?metric=all` under `metric`.
 */
export function extractSharesOutstandingFromBasicMetric(
  payload: unknown,
): number | null {
  const metric = getMetricMap(payload);
  if (!metric) return null;

  const a = sharesFromMetricMillionsOrFull(
    parseFinnhubNumber(metric.sharesOutstanding),
  );
  if (a !== null) return a;

  const b = sharesFromMetricMillionsOrFull(
    parseFinnhubNumber(metric.shareOutstanding),
  );
  if (b !== null) return b;

  const c = sharesFromMetricMillionsOrFull(parseFinnhubNumber(metric.shares));
  if (c !== null) return c;

  return null;
}

/**
 * Finnhub `profile2.marketCapitalization` is usually **millions of USD**; very large values may already be full USD.
 */
function marketCapitalizationToUsd(raw: number): number | null {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  if (raw >= 1e9) return raw;
  return raw * 1_000_000;
}

/**
 * Implied shares: market cap (USD) ÷ last price.
 */
export function extractSharesOutstandingFromMarketCap(
  marketCap: number | null,
  price: number,
): number | null {
  if (marketCap === null || !Number.isFinite(marketCap) || marketCap <= 0) {
    return null;
  }
  if (!Number.isFinite(price) || price <= 0) return null;
  const capUsd = marketCapitalizationToUsd(marketCap);
  if (capUsd === null) return null;
  const implied = capUsd / price;
  if (!Number.isFinite(implied) || implied <= 0) return null;
  return implied;
}

/**
 * Resolve share count: metric (A→B→C), then marketCap / price.
 */
export function resolveSharesOutstanding(
  metricPayload: unknown,
  marketCap: number | null,
  price: number,
): number | null {
  const fromMetric = extractSharesOutstandingFromBasicMetric(metricPayload);
  if (fromMetric !== null && fromMetric > 0) return fromMetric;
  return extractSharesOutstandingFromMarketCap(marketCap, price);
}
