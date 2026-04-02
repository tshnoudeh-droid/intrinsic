/**
 * Parse numeric values from Finnhub payloads (numbers may arrive as strings).
 */
export function parseFinnhubNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

type ReportedRow = Record<string, unknown>;

/**
 * Finnhub `/stock/financials-reported` returns `data[]` with nested `report.cf`
 * line items. We take the latest annual filing and look for a Free Cash Flow line.
 */
export function extractLatestAnnualFcfFromFinancialsReported(
  payload: unknown,
): number | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) return null;

  // Prefer full-year filings; omit Q1–Q3 when quarter is present.
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

  for (const filing of sorted) {
    if (!filing || typeof filing !== "object") continue;
    const report = (filing as { report?: unknown }).report;
    const n = fcfFromReportBlock(report);
    if (n !== null) return n;
  }

  return null;
}

function fcfFromReportBlock(report: unknown): number | null {
  if (!report || typeof report !== "object") return null;
  const r = report as Record<string, unknown>;
  const cf = r.cf;
  return scanCfLike(cf);
}

function scanCfLike(cf: unknown): number | null {
  if (Array.isArray(cf)) {
    for (const row of cf) {
      if (!row || typeof row !== "object") continue;
      const o = row as ReportedRow;
      const label = String(o.label ?? o.concept ?? o.name ?? "").toLowerCase();
      const isFcf =
        (label.includes("free") &&
          label.includes("cash") &&
          label.includes("flow")) ||
        /free\s*cash\s*flow/i.test(label);
      if (!isFcf) continue;
      const v = parseFinnhubNumber(
        o.value ?? o.amount ?? o.val ?? o.v ?? o.number,
      );
      if (v !== null) return v;
    }
    return null;
  }

  if (cf && typeof cf === "object") {
    for (const v of Object.values(cf)) {
      const n = scanCfLike(v);
      if (n !== null) return n;
    }
  }

  return null;
}

/**
 * `/stock/metric?metric=all` returns `metric` (snapshot) and `series` (annual/quarterly).
 * We prefer the latest annual point from `series` when present, else fall back to `metric`.
 */
export function extractNetIncomeFromBasicFinancials(
  payload: unknown,
): number | null {
  const fromSeries = latestAnnualSeriesValue(payload, [
    "netIncome",
    "netIncomeCommonStockholders",
    "netIncomeApplicableToCommonShares",
  ]);
  if (fromSeries !== null) return fromSeries;

  const metric = getMetricMap(payload);
  if (!metric) return null;

  const preferredKeys = [
    "netIncome",
    "netIncomeCommonStockholders",
    "netIncomeApplicableToCommonShares",
  ];
  for (const key of preferredKeys) {
    const v = parseFinnhubNumber(metric[key]);
    if (v !== null) return v;
  }

  for (const [key, val] of Object.entries(metric)) {
    if (!/netincome/i.test(key)) continue;
    if (/pershare|margin|growth|ttm$/i.test(key)) continue;
    const v = parseFinnhubNumber(val);
    if (v !== null) return v;
  }

  return null;
}

export function extractFcfFromBasicFinancials(payload: unknown): number | null {
  const fromSeries = latestAnnualSeriesValue(payload, ["freeCashFlow"]);
  if (fromSeries !== null) return fromSeries;

  const metric = getMetricMap(payload);
  if (!metric) return null;

  const keys = [
    "freeCashFlow",
    "freeCashFlowTTM",
    "freeCashFlowAnnual",
    "fcf",
  ];
  for (const key of keys) {
    const v = parseFinnhubNumber(metric[key]);
    if (v !== null) return v;
  }

  for (const [key, val] of Object.entries(metric)) {
    if (!/^freeCashFlow/i.test(key) && !/^fcf$/i.test(key)) continue;
    const v = parseFinnhubNumber(val);
    if (v !== null) return v;
  }

  return null;
}

export function extractSharesOutstanding(
  basicPayload: unknown,
  profileShareOutstanding: number | null,
): number | null {
  const fromSeries = latestAnnualSeriesValue(basicPayload, [
    "shareOutstanding",
    "weightedAverageShsOut",
    "weightedAverageShsOutDil",
  ]);
  if (fromSeries !== null) return fromSeries;

  const metric = getMetricMap(basicPayload);
  if (metric) {
    const keys = [
      "shareOutstanding",
      "sharesOutstanding",
      "numberOfShares",
      "weightedAverageShsOut",
    ];
    for (const key of keys) {
      const v = parseFinnhubNumber(metric[key]);
      if (v !== null) return v;
    }
  }

  return profileShareOutstanding;
}

function getMetricMap(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const m = (payload as { metric?: unknown }).metric;
  if (!m || typeof m !== "object") return null;
  return m as Record<string, unknown>;
}

function latestAnnualSeriesValue(
  payload: unknown,
  metricNames: string[],
): number | null {
  if (!payload || typeof payload !== "object") return null;
  const series = (payload as { series?: unknown }).series;
  if (!series || typeof series !== "object") return null;
  const annual = (series as { annual?: unknown }).annual;
  if (!annual || typeof annual !== "object") return null;
  const ann = annual as Record<string, unknown>;

  for (const name of metricNames) {
    const arr = ann[name];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const sorted = [...arr].sort((a, b) => {
      const pa = String((a as { period?: unknown }).period ?? "");
      const pb = String((b as { period?: unknown }).period ?? "");
      return pb.localeCompare(pa);
    });
    const v = parseFinnhubNumber((sorted[0] as { v?: unknown }).v);
    if (v !== null) return v;
  }

  return null;
}
