import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import {
  SCREENER_FILTERABLE_FIELDS,
  SCREENER_FILTER_OPERATORS,
  SCREENER_VALUATION_LABELS,
  type ScreenerFilter,
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

Respond with ONLY JSON matching this shape, nothing else, no markdown code fence:
{"filters":[{"field":"margin_of_safety","operator":"gte","value":20}]}

If the query doesn't map to any of the allowed fields, respond with {"filters":[]}.`;

function isValidFilter(f: unknown): f is ScreenerFilter {
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
      typeof o.value === "string" &&
      (SCREENER_VALUATION_LABELS as readonly string[]).includes(o.value)
    );
  }
  return typeof o.value === "number" && Number.isFinite(o.value);
}

export type ParseScreenerQueryResult =
  | { ok: true; filters: ScreenerFilter[] }
  | { ok: false; reason: string };

const UNPARSEABLE_MESSAGE =
  'Couldn\'t understand that — try phrasing like "margin of safety above 20%, P/E below 30".';

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

  const filtersRaw = (parsed as { filters?: unknown }).filters;
  if (!Array.isArray(filtersRaw) || filtersRaw.length === 0) {
    return { ok: false, reason: UNPARSEABLE_MESSAGE };
  }

  const filters = filtersRaw.filter(isValidFilter);
  if (filters.length === 0) {
    return {
      ok: false,
      reason:
        "None of those conditions map to a supported field. Supported: margin of safety, valuation, market cap, P/E, forward P/E, revenue growth, price.",
    };
  }

  return { ok: true, filters };
}
