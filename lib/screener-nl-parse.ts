import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import {
  DEFAULT_SCREENER_INTENT,
  ETF_CATEGORIES,
  SCREENER_ASSET_TYPES,
  SCREENER_FILTERABLE_FIELDS,
  SCREENER_FILTER_OPERATORS,
  SCREENER_VALUATION_LABELS,
  type EtfCategory,
  type ScreenerAssetType,
  type ScreenerFilter,
  type ScreenerIntent,
} from "@/lib/screener-types";

// Same model as the Phase 1 chatbot (app/api/chat/route.ts) — Llama 3.3
// 70B was retired from Groq; gpt-oss-120b is the current closest free-tier
// equivalent. Verify at console.groq.com/docs/models if retired.
const GROQ_MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `You convert a stock screener query written in plain English into a structured filter list.

Allowed fields (use exactly these names):
- margin_of_safety: percent, e.g. 20 for 20%
- valuation_label: one of "Undervalued", "Fair", "Overvalued"
- market_cap: dollars, e.g. 1000000000 for $1B, 1000000000000 for $1T
- pe_ratio: trailing P/E ratio, plain number
- forward_pe: forward P/E ratio, plain number
- revenue_growth: decimal, e.g. 0.10 for 10%
- price: dollars per share, plain number

Allowed operators: gt, gte, lt, lte, eq.

Also return an "intent" describing which kinds of investments fit:
- assetTypes: ordered list of "etf" and/or "stock"; the first is the best fit.
  Put "etf" first when the user wants something long-term, passive, low risk, diversified, beginner-friendly, hands-off, retirement, an index fund, or mentions ETFs/funds. Otherwise put "stock" first. Include both unless the user clearly wants only one.
- etfCategories (optional): which ETF groups fit, from: ${ETF_CATEGORIES.join(", ")}.
  e.g. low risk / long term -> all-in-one, us-total-market, sp500; income / dividends -> dividend; Canadian -> canadian-equity; bonds / very safe -> bonds; growth / tech -> growth; international -> international.

Respond with ONLY JSON matching this shape, nothing else, no markdown code fence:
{"filters":[{"field":"margin_of_safety","operator":"gte","value":20}],"intent":{"assetTypes":["stock","etf"]}}

Users often describe goals in everyday language instead of metrics. Translate those into reasonable proxy filters on the allowed fields rather than giving up. Guidelines:
- "safe", "low risk", "stable", "trustworthy", "blue chip", "established": market_cap gte 50000000000 and pe_ratio lte 25
- "cheap", "bargain", "good deal", "value": valuation_label eq "Undervalued" (optionally margin_of_safety gte 15)
- "growth", "growing fast": revenue_growth gte 0.10
- "steady/modest return of about X% a year": revenue_growth gte a value near X/2 as a decimal (e.g. 6% -> 0.03), plus margin_of_safety gte 0
- "big company" / "small company": market_cap gte 10000000000 / market_cap lte 2000000000
- "not overpriced", "reasonably priced": pe_ratio lte 25
Combine multiple goals into multiple filters. Keep the list short (1-4 filters).

Example: "something trustworthy in the long run, about 6% return annually, low risk"
{"filters":[{"field":"market_cap","operator":"gte","value":50000000000},{"field":"pe_ratio","operator":"lte","value":25},{"field":"revenue_growth","operator":"gte","value":0.03},{"field":"margin_of_safety","operator":"gte","value":0}],"intent":{"assetTypes":["etf","stock"],"etfCategories":["all-in-one","us-total-market","sp500"]}}

Example: "index funds for beginners"
{"filters":[],"intent":{"assetTypes":["etf"],"etfCategories":["all-in-one","us-total-market","sp500","canadian-equity"]}}

Example: "cheap growing tech"
{"filters":[{"field":"valuation_label","operator":"eq","value":"Undervalued"},{"field":"revenue_growth","operator":"gte","value":0.1}],"intent":{"assetTypes":["stock","etf"],"etfCategories":["growth"]}}

Only respond with {"filters":[],"intent":{"assetTypes":[]}} if the query has nothing to do with investing.`;

export function isValidFilter(f: unknown): f is ScreenerFilter {
  if (!f || typeof f !== "object") return false;
  const o = f as Record<string, unknown>;
  if (
    typeof o.field !== "string" ||
    !(SCREENER_FILTERABLE_FIELDS as readonly string[]).includes(o.field)
  ) {
    return false;
  }
  if (
    typeof o.operator !== "string" ||
    !(SCREENER_FILTER_OPERATORS as readonly string[]).includes(o.operator)
  ) {
    return false;
  }
  if (o.field === "valuation_label") {
    return (
      o.operator === "eq" &&
      typeof o.value === "string" &&
      (SCREENER_VALUATION_LABELS as readonly string[]).includes(o.value)
    );
  }
  return typeof o.value === "number" && Number.isFinite(o.value);
}

function uniqueValid<T extends string>(raw: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const v of raw) {
    if (typeof v === "string" && (allowed as readonly string[]).includes(v) && !out.includes(v as T)) {
      out.push(v as T);
    }
  }
  return out;
}

/** Strict validation; anything malformed is dropped, never trusted. */
export function parseScreenerIntent(raw: unknown): ScreenerIntent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const assetTypes = uniqueValid<ScreenerAssetType>(o.assetTypes, SCREENER_ASSET_TYPES);
  if (assetTypes.length === 0) return null;
  const etfCategories = uniqueValid<EtfCategory>(o.etfCategories, ETF_CATEGORIES);
  return etfCategories.length > 0 ? { assetTypes, etfCategories } : { assetTypes };
}

// Deterministic backstop in case the model leaves ETFs out of obviously
// passive / long-term queries.
const ETF_FIRST_PATTERN =
  /\b(etfs?|index|indexes|indices|fund|funds|passive|diversif\w*|beginners?|long[\s-]?(run|term)|retire\w*|hands[\s-]?off|low[\s-]?risk|safe|safest)\b/i;

function finalizeIntent(query: string, intent: ScreenerIntent | null): ScreenerIntent {
  const base = intent ?? DEFAULT_SCREENER_INTENT;
  if (!ETF_FIRST_PATTERN.test(query) || base.assetTypes[0] === "etf") return base;
  const rest = base.assetTypes.filter((t) => t !== "etf");
  return { ...base, assetTypes: ["etf", ...rest] };
}

export type ParseScreenerQueryResult =
  | { ok: true; filters: ScreenerFilter[]; intent: ScreenerIntent }
  | { ok: false; reason: string };

const UNPARSEABLE_MESSAGE =
  "I couldn't turn that into a screen. Try something like \"undervalued and P/E below 20\" or \"index funds for beginners\".";

export async function parseScreenerQuery(
  query: string,
): Promise<ParseScreenerQueryResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, reason: "Query is empty." };
  }

  let raw: string;
  try {
    const result = await generateText({
      model: groq(GROQ_MODEL),
      system: SYSTEM_PROMPT,
      prompt: trimmed,
    });
    raw = result.text.trim();
  } catch {
    return { ok: false, reason: "Couldn't reach the query parser. Try again." };
  }

  let parsed: unknown;
  try {
    // Model sometimes wraps JSON in a code fence despite instructions.
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return { ok: false, reason: UNPARSEABLE_MESSAGE };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: UNPARSEABLE_MESSAGE };
  }

  const filtersRaw = (parsed as { filters?: unknown }).filters;
  const modelIntent = parseScreenerIntent((parsed as { intent?: unknown }).intent);
  const filters = Array.isArray(filtersRaw) ? filtersRaw.filter(isValidFilter) : [];

  // ETF-only answers ("index funds for beginners") legitimately have no stock
  // filters; everything else needs at least one usable filter.
  const etfOnly = modelIntent !== null && modelIntent.assetTypes[0] === "etf";
  if (filters.length === 0 && !etfOnly) {
    const hadFilters = Array.isArray(filtersRaw) && filtersRaw.length > 0;
    return {
      ok: false,
      reason: hadFilters
        ? "None of those conditions map to a supported field. Supported: margin of safety, valuation, market cap, P/E, forward P/E, revenue growth, price."
        : UNPARSEABLE_MESSAGE,
    };
  }

  return { ok: true, filters, intent: finalizeIntent(trimmed, modelIntent) };
}
