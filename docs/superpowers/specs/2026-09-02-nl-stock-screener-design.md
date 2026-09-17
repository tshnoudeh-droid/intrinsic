# Natural Language Stock Screener (Phase 2)

## Goal

User types a free-text checklist ("margin of safety above 20%, revenue growth
above 10%, P/E below 30") and Intrinsic screens the S&P 500 + TSX 60
(~560 stocks) against it, returning matches instantly. Idea originated with
the founder's capital markets mentor; this is Phase 2 of Intrinsic's 2026
summer roadmap, following the Phase 1 AI chatbot.

## Non-goals (v1)

- No OR logic / complex boolean queries — AND of simple comparisons only.
- No historical snapshots — nightly data overwrites the previous run.
- No stocks outside the S&P 500 + TSX 60 static list.
- No per-user saved screens.

## Architecture

```
supabase/
  schema.sql                          — screener_stocks table (run manually in Supabase SQL editor)
lib/
  sp500-tsx60-tickers.ts              — static ~560-ticker list (symbol + exchange)
  screener-types.ts                   — ScreenerFilter, ScreenerStockRow types
  screener-query.ts                   — builds a Supabase query from parsed filters
  screener-nl-parse.ts                — Groq call: free text -> structured filter JSON
  supabase-client.ts                  — Supabase server client (service-role key, server-only)
app/api/screener/route.ts             — POST: parse NL query, query Supabase, return matches
app/api/cron/refresh-screener/route.ts — nightly: loop ticker list, compute DCF, upsert into Supabase
app/screener/page.tsx                 — UI: text input + results table
components/ScreenerResultsTable.tsx
vercel.json                           — cron schedule entry -> /api/cron/refresh-screener
```

The nightly cron reuses the existing `computeStockPayloadFromYahoo` (already
builds DCF/margin/P/E/etc per symbol for the stock page) — no new valuation
logic. It loops the static ticker list, computes each payload, and upserts
into `screener_stocks`.

**Query flow:** user submits free text -> `/api/screener` sends it to Groq
with a system prompt constrained to a fixed field/operator list -> Groq
returns structured filter JSON -> server validates the JSON against the
whitelist (never trusts model output as raw SQL) -> builds a Supabase
`.gte()/.lte()` query from validated filters -> returns matches (already
precomputed, so the query itself is fast).

**Cron auth:** Vercel Cron calls the route with a bearer token
(`CRON_SECRET` env var) that the route checks. Without a valid token the
route returns 401 and does no work — otherwise it would be a public,
unauthenticated trigger for ~560 Yahoo Finance calls.

## Data model

```sql
create table screener_stocks (
  symbol text primary key,
  name text not null,
  exchange text not null,          -- e.g. NASDAQ, NYSE, TSX
  price numeric not null,
  intrinsic_value numeric,
  margin_of_safety numeric,        -- percent, e.g. 13.2
  valuation_label text,            -- 'Undervalued' | 'Fair' | 'Overvalued'
  market_cap numeric,
  pe_ratio numeric,
  forward_pe numeric,
  revenue_growth numeric,          -- decimal, e.g. 0.12
  updated_at timestamptz not null default now()
);
```

One row per symbol, upserted nightly on `symbol`. Nulls are allowed wherever
the DCF is unavailable for that stock (same cases as `unavailableReason` on
the stock page) — those rows simply won't match numeric filters, which is
correct: you can't screen on data that doesn't exist. No history/versioning;
each nightly run overwrites the previous snapshot.

## Filterable fields (v1)

`margin_of_safety`, `valuation_label`, `market_cap`, `pe_ratio`,
`forward_pe`, `revenue_growth`, `price` — the same fields already shown on
every stock page. Chosen over including DCF assumption fields
(growth rate used, discount rate used) to keep v1 scope tight; those can be
added later without a schema change if wanted.

## NL parsing

Groq system prompt restricts output to a fixed JSON shape:

```json
{ "filters": [
  { "field": "margin_of_safety", "operator": "gte", "value": 20 },
  { "field": "revenue_growth", "operator": "gte", "value": 0.10 },
  { "field": "pe_ratio", "operator": "lt", "value": 30 }
] }
```

Allowed operators: `gt`, `gte`, `lt`, `lte`, `eq`. Allowed fields: the
filterable list above. Values are plain numbers in the field's native unit
(e.g. revenue growth as a decimal, so "10%" in user text becomes `0.10`,
stated explicitly in the prompt). The server validates every field/operator
against the whitelist before building any query — model output never
reaches the database as raw SQL or an unvalidated field name.

If parsing fails, times out, or yields zero filters, the UI shows a message
("couldn't understand that — try phrasing like 'margin of safety above
20%'") instead of silently returning the full unfiltered table.

## UI

`/screener` page: a text input at the top (placeholder text mirrors the
example in the roadmap doc), a submit button, and a results table below —
Symbol, Name, Price, Margin of Safety, Valuation, P/E, Revenue Growth.
Clicking a row navigates to `/stock/[symbol]`. Before the first query, the
page shows a few example query chips that fill the input on click. A "last
updated" timestamp (from `updated_at`) is shown so users know data
freshness. No auth gate — everyone can use it, matching the chatbot's
access model (querying a small precomputed table is cheap; there's no
per-request external cost to protect here the way there is with the
chatbot's Groq calls).

The navbar (`components/Navbar.tsx`) gets a persistent "Screener" text link
next to the logo, visible regardless of sign-in state.

## Error handling

- Yahoo fetch fails for a symbol during the nightly cron: skip that symbol,
  continue the batch, log which symbols failed. One bad ticker never fails
  the whole run (matches `computeStockPayloadFromYahoo`'s existing
  graceful-null behavior).
- Groq parse fails or times out: friendly "couldn't understand that"
  message in the UI, no crash.
- Cron endpoint hit without a valid `CRON_SECRET`: 401, no work done.
- Supabase unreachable: screener page shows "screener temporarily
  unavailable" without affecting any other part of the app (isolated
  failure, same pattern used for chatbot/news fetch failures elsewhere).

## Environment

New env vars required (local `.env.local` + Vercel), following the same
pattern as `GROQ_API_KEY` and the Upstash vars from Phase 1:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — server-only, never exposed
  to the client; used by `lib/supabase-client.ts` and the cron route.
- `CRON_SECRET` — bearer token Vercel Cron sends; the cron route rejects
  any request without a matching token.

## Testing

- Typecheck + lint on all new/changed files (project convention).
- Manual verification of the nightly cron route with a small subset of
  tickers before wiring the full ~560-symbol list.
- Manual verification of NL parsing against a handful of representative
  queries (the exact example from the roadmap doc, an empty/nonsense query,
  a query using an unsupported field).
- Browser click-through of `/screener`: submit a query, confirm the table
  renders and row click navigates to the right stock page.
