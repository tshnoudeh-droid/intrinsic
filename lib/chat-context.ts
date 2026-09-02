import type { StockNewsItem } from "@/lib/stock-news";

/**
 * Snapshot of what's currently on screen for this stock, including any
 * assumption-slider adjustments the user has made. Built client-side (the
 * chat has no server session) and sent with every chat request so the model
 * always answers against what the user is actually looking at.
 */
export type ChatStockContext = {
  symbol: string;
  name: string;
  price: number;
  intrinsicValue: number | null;
  marginOfSafety: number | null;
  valuationLabel: "Undervalued" | "Fair" | "Overvalued" | null;
  growthRate: number;
  growthSource: "analyst" | "historical" | "default";
  discountRate: number;
  terminalGrowth: number;
  cashFlowSource: "freeCashflow" | "computed" | "operatingOnly" | "earnings" | null;
  marketCap: number | null;
  peRatio: number | null;
  forwardPE: number | null;
  revenueGrowth: number | null;
  week52High: number | null;
  week52Low: number | null;
  regulatoryNote: string | null;
  news: StockNewsItem[];
};

const MAX_STRING_FIELD_LENGTH = 200;
const MAX_NEWS_ITEMS = 5;
const MAX_NEWS_TITLE_LENGTH = 300;

function clampString(v: string, max: number): string {
  return v.length > max ? v.slice(0, max) : v;
}

/**
 * Client-supplied context is fully attacker-controllable (it's just what the
 * page rendered, sent back over the wire) — clamp string/array sizes before
 * they're interpolated into the system prompt so a crafted request can't
 * inflate token cost or pad the prompt with an unbounded payload.
 */
export function sanitizeChatStockContext(
  ctx: ChatStockContext,
): ChatStockContext {
  return {
    ...ctx,
    symbol: clampString(ctx.symbol, MAX_STRING_FIELD_LENGTH),
    name: clampString(ctx.name, MAX_STRING_FIELD_LENGTH),
    regulatoryNote: ctx.regulatoryNote
      ? clampString(ctx.regulatoryNote, MAX_STRING_FIELD_LENGTH * 2)
      : null,
    news: ctx.news.slice(0, MAX_NEWS_ITEMS).map((item) => ({
      title: clampString(item.title, MAX_NEWS_TITLE_LENGTH),
      publisher: clampString(item.publisher, MAX_STRING_FIELD_LENGTH),
      publishedAt: item.publishedAt,
    })),
  };
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtNum(v: number | null): string {
  return v === null || !Number.isFinite(v) ? "unavailable" : v.toFixed(2);
}

function cashFlowSourceLabel(
  source: ChatStockContext["cashFlowSource"],
): string {
  switch (source) {
    case "freeCashflow":
      return "reported free cash flow";
    case "computed":
      return "operating cash flow minus capex";
    case "operatingOnly":
      return "operating cash flow only (capex unavailable)";
    case "earnings":
      return "trailing EPS × shares (fallback, no usable cash flow data)";
    default:
      return "unavailable";
  }
}

export function buildChatSystemPrompt(ctx: ChatStockContext): string {
  const newsLines =
    ctx.news.length > 0
      ? ctx.news.map((n) => `- "${n.title}" (${n.publisher})`).join("\n")
      : "No recent news available.";

  return `You are Intrinsic AI, the assistant built into the Intrinsic stock valuation app.

You are currently loaded on the page for ${ctx.name} (${ctx.symbol}). Here is Intrinsic's own model output for this stock, exactly as the user sees it on screen right now (reflects any assumption sliders the user has adjusted):

- Current price: $${fmtNum(ctx.price)}
- Intrinsic value (Intrinsic's DCF estimate): ${ctx.intrinsicValue !== null ? `$${fmtNum(ctx.intrinsicValue)}` : "unavailable for this stock"}
- Margin of safety: ${ctx.marginOfSafety !== null ? fmtPct(ctx.marginOfSafety / 100) : "unavailable"}
- Valuation label: ${ctx.valuationLabel ?? "unavailable"}
- Growth rate assumption: ${fmtPct(ctx.growthRate)} (source: ${ctx.growthSource})
- Discount rate assumption: ${fmtPct(ctx.discountRate)}
- Terminal growth assumption: ${fmtPct(ctx.terminalGrowth)}
- Cash flow basis: ${cashFlowSourceLabel(ctx.cashFlowSource)}
- Market cap: ${ctx.marketCap !== null ? `$${fmtNum(ctx.marketCap)}` : "unavailable"}
- P/E (trailing / forward): ${ctx.peRatio !== null ? fmtNum(ctx.peRatio) : "n/a"} / ${ctx.forwardPE !== null ? fmtNum(ctx.forwardPE) : "n/a"}
- Revenue growth: ${ctx.revenueGrowth !== null ? fmtPct(ctx.revenueGrowth) : "unavailable"}
- 52-week range: ${ctx.week52Low !== null ? `$${fmtNum(ctx.week52Low)}` : "n/a"} – ${ctx.week52High !== null ? `$${fmtNum(ctx.week52High)}` : "n/a"}
${ctx.regulatoryNote ? `- Regulatory note: ${ctx.regulatoryNote}` : ""}

Recent news for ${ctx.symbol}:
${newsLines}

Rules:
1. Answer using the numbers above — they are Intrinsic's own model, not generic knowledge. When asked "why is this stock undervalued/overvalued," explain using the margin of safety, growth/discount rate assumptions, and cash flow basis above.
2. Stay focused on ${ctx.symbol}. General finance/investing concepts (e.g. "what is a margin of safety," "what does P/E mean") are fine to explain, but always tie the explanation back to this stock's numbers where possible.
3. If asked about a different stock or an unrelated topic, briefly redirect: explain you're scoped to ${ctx.symbol} on this page, and suggest they search that stock in Intrinsic.
4. Intrinsic's model is a simplified 2-stage DCF with explicit assumptions (shown above) — be transparent that this is a model estimate, not a guarantee, and assumptions can be adjusted in the "Adjust assumptions" panel.
5. Keep answers concise and readable in a chat panel — short paragraphs, no long essays unless asked for depth.
6. Never fabricate financial data not shown above or in the news list. If something isn't in this context, say you don't have that figure.`;
}
