@AGENTS.md

# Project: Intrinsic

## Overview
Intrinsic is a Canadian-focused stock valuation web app that determines whether a stock is overvalued, fairly valued, or undervalued using a Smart Simplified DCF (Discounted Cash Flow) model.

The app is designed to be:
- Accurate
- Simple
- Visually clean
- Beginner-friendly
- Built using real financial data

**Supported markets (V1):** US and Canadian exchanges only (NYSE, NASDAQ, TSX, TSX-V, NEO). Search results are filtered accordingly.

---

## Core Features (V1 Scope)

1. Stock Search
- Autocomplete search bar
- Filtered to NYSE, NASDAQ, TSX, TSX-V (and related Finnhub exchange codes); common stock only
- User can search by ticker or company name

2. Stock Page
Displays:
- Current Price
- Intrinsic Value
- % Overvalued / Undervalued
- Margin of Safety
- Valuation Label (Undervalued / Fair / Overvalued)

3. Chart
- Time ranges:
  - 1D, 1M, 3M, YTD, 1Y
- Displays stock price
- Displays intrinsic value as a reference line

4. Valuation Engine
- Smart Simplified DCF model
- Uses real financial data with explicit cash-flow priority:
  1. `financialData.freeCashflow` (Yahoo) when positive
  2. Computed from cash flow statements: operating cash flow − |capex| (when free cash flow is unavailable or not positive)
  3. `financialData.operatingCashflow` alone when capex is not available
  4. Earnings fallback: `defaultKeyStatistics.trailingEps` × shares outstanding (last resort)
- Server response includes `cashFlowSource`: `freeCashflow` | `computed` | `operatingOnly` | `earnings`
- Default assumptions:
  - **Growth rate**
    - **Primary:** `earningsTrend` row with `period === "+5y"`, using `earningsEstimate.growth`; if missing, same from `"+1y"`; then `financialData.revenueGrowth` (capped 0–30%); then historical revenue CAGR (capped at 10%); then **default** 5%
  - **Discount rate**
    - **Default:** 9% ("Balanced")
    - **Presets (stock page, `lib/discount-presets.ts`):** Cautious 10% / Balanced 9% / Optimistic 7%; exact slider (4% to 12%) under "Advanced"
    - **Rationale:** ~4% government bond yield plus ~5% equity risk premium. The original 6% made ~60% of the universe look Undervalued, so the label stopped discriminating; changed 2026-11-07.
  - **Terminal growth:** 2.5% (unchanged)
  - **Projection years:** 5 (unchanged)
- Symbol normalization converts TSX class tickers (e.g. `RCI.B.TO` → `RCI-B.TO`) and US class shares (`BRK.B` → `BRK-B`).
- Intrinsic value is guarded by a trailing P/E sanity check (vs. P/E–implied value) in addition to other data checks.
- **Guards** (all in `lib/calculate-dcf-client.ts`, shared by the server payload/cron screener and the stock page sliders so they always agree):
  - Growth used for the default projection is capped at 15% (`MAX_DEFAULT_PROJECTION_GROWTH`), after the source priority above.
  - Sanity check: intrinsic value is discarded (`calculation_error`) when above 3× the P/E-implied value, trailing EPS × trailing P/E (or price when P/E is unusable) (`MAX_INTRINSIC_TO_PE_IMPLIED`).
  - Cash flow above 25% or below 0.01% of market cap is treated as implausible and that tier is skipped. It is never rescaled.
- **Units:** shares = `defaultKeyStatistics.impliedSharesOutstanding` (all share classes), falling back to `sharesOutstanding`. Cash flows are converted from `financialData.financialCurrency` to the listing currency (Yahoo FX quote, e.g. `USDCAD=X`). Trailing EPS is already in listing currency.
- **Margin of safety** = (intrinsic − price) / intrinsic × 100, so it is at most 100%. Above +15% → Undervalued, below −15% → Overvalued, otherwise Fair. Display clamps values below −100% to "< -100%".
- Run `npx tsx scripts/check-valuation.ts` (fixture) or `--live` after touching the valuation engine.

---

## Tech Stack

Frontend:
- Next.js (App Router)
- React
- Tailwind CSS

Backend:
- Next.js API routes

Data:
- yahoo-finance2 (stock fundamentals + historical prices)
- Finnhub API (search autocomplete only)

Deployment:
- Vercel

Version Control:
- GitHub

---

## Design Principles

- Minimal (Apple-style UI)
- Clean spacing and typography
- Neutral, soft color palette
- No clutter
- Focus on clarity over complexity

Color Palette:
- #EDE8DF (main background)
- #DEF0E8 (accent)
- #A69486 (secondary)
- #FAF8F4 (light background)

---

## Smart Simplified DCF Model (IMPORTANT)

The valuation model MUST follow these rules:

1. Cash flow priority: `freeCashflow` → statement-based FCF → `operatingCashflow` only → earnings (trailing EPS × shares). Negative reported FCF is skipped for that tier.
2. If no usable cash flow path exists, handle gracefully (no crash).

3. Use default assumptions as documented above under "Valuation Engine".

4. Keep model simple:
- Max 1–2 growth stages
- No overly complex multi-stage modeling

5. Output:
- Intrinsic Value
- Margin of Safety (%)

6. All calculations must be deterministic and transparent

---

## API Rules (CRITICAL)

1. Use Yahoo Finance for quotes, fundamentals, and history via `yahoo-finance2`; use Finnhub **only** for search autocomplete
2. DO NOT invent endpoints
3. DO NOT hallucinate data structures
4. Always verify:
   - Endpoint exists
   - Data fields exist

5. If data is missing:
   - Handle gracefully
   - DO NOT crash

6. Cache data when appropriate to avoid rate limits

---

## Backend Rules

- All API calls must go through Next.js API routes
- NEVER call external APIs directly from frontend
- Keep logic modular and reusable
- Validate all inputs

---

## Frontend Rules

- Use clean component structure
- Avoid unnecessary state complexity
- Use reusable components
- Keep UI minimal and readable

---

## Chart Rules

- Use a lightweight chart library
- Must support multiple timeframes
- Intrinsic value should be shown as a horizontal reference line

---

## Code Quality Rules

1. DO NOT overengineer
2. DO NOT introduce unnecessary libraries
3. Keep functions small and readable
4. Use clear naming
5. Write maintainable code

---

## Development Workflow (STRICT)

1. Build in small steps
2. Ensure each step works before moving on
3. NEVER skip steps
4. NEVER assume missing information

---

## Error Handling

- Always handle:
  - Missing API data
  - Failed requests
  - Invalid inputs

- Provide fallback UI states

---

## Anti-Hallucination Rules (VERY IMPORTANT)

1. If ANY requirement is unclear → ASK
2. If ANY API detail is unknown → ASK
3. DO NOT guess
4. DO NOT fabricate logic
5. DO NOT proceed with uncertainty

---

## Performance Considerations

- Minimize API calls
- Use caching when possible
- Avoid unnecessary re-renders

---

## Future Scope (DO NOT BUILD YET)

- User accounts
- Watchlists
- Alerts
- Custom DCF inputs
- AI explanations

---

## Final Instruction

You must:
- Follow all rules above strictly
- Ask for clarification if anything is unclear
- Build step-by-step
- Prioritize correctness over speed
