# Natural Language Stock Screener Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user type a free-text checklist ("margin of safety above 20%, revenue growth above 10%, P/E below 30") and get a table of matching stocks from a nightly-precomputed S&P 500 + TSX 60 dataset.

**Architecture:** A Vercel Cron job loops a static ~560-ticker list nightly, reuses the existing `computeStockPayloadFromYahoo` DCF logic per symbol, and upserts results into a Supabase table. A `/api/screener` route sends the user's free text to Groq (same provider as the Phase 1 chatbot) to get back a structured, whitelisted filter list, then queries Supabase with it. Results are already computed, so queries are instant.

**Tech Stack:** Next.js App Router, `@supabase/supabase-js`, `@ai-sdk/groq` + `ai` (already installed from Phase 1), existing `yahoo-finance2`-based valuation code, Vercel Cron.

## Global Constraints

- Reuse `computeStockPayloadFromYahoo` (`lib/yahoo-stock-payload.ts`) for all DCF computation — no new valuation logic (spec: "Architecture").
- Filterable fields limited to: `margin_of_safety`, `valuation_label`, `market_cap`, `pe_ratio`, `forward_pe`, `revenue_growth`, `price` (spec: "Filterable fields (v1)").
- NL parsing must validate Groq's output against a fixed field/operator whitelist server-side before building any query — model output never becomes raw SQL or an unvalidated field name (spec: "NL parsing").
- No OR logic, no historical snapshots, no stocks outside the static S&P 500 + TSX 60 list, no per-user saved screens (spec: "Non-goals (v1)").
- Screener has no auth gate — usable by everyone (spec: "UI").
- Cron endpoint must reject requests without a valid `CRON_SECRET` bearer token (spec: "Cron auth").
- This codebase has no test framework (`jest`/`vitest`/etc not installed) — verification uses `npx tsc --noEmit`, `npx eslint`, and manual `curl`/browser checks, matching the project's existing convention (confirmed: `package.json` scripts are only `dev`/`build`/`start`/`lint`).
- Follow existing design tokens: `bg-intrinsic-light`, `text-intrinsic-ink`, `text-intrinsic-secondary`, `border-intrinsic-secondary/*`, rounded-full pill buttons, matching `StockPageContent.tsx` / `KeyStats.tsx` / `ChatPanel.tsx`.

---

### Task 1: Generate the static S&P 500 + TSX 60 ticker list

**Files:**
- Create: `scripts/generate-tickers.py`
- Create: `lib/sp500-tsx60-tickers.ts` (generated output, committed to the repo)

**Interfaces:**
- Produces: `SCREENER_TICKERS: ScreenerTicker[]` where `ScreenerTicker = { symbol: string; exchange: "US" | "TSX" }`. Later tasks (6) iterate this array.

- [ ] **Step 1: Write the generator script**

```python
#!/usr/bin/env python3
"""One-off generator for lib/sp500-tsx60-tickers.ts.

Re-run this script a few times a year when S&P 500 / TSX 60 constituents
change (see docs/superpowers/specs/2026-09-04-nl-stock-screener-design.md,
"Non-goals" — this list is static, not auto-refreshed). Not part of the
app runtime.

Usage: python3 scripts/generate-tickers.py
"""
import json
import re
import urllib.request

HEADERS = {"User-Agent": "intrinsic-ticker-sync/1.0"}


def fetch_wikitext(page_title: str) -> str:
    url = (
        "https://en.wikipedia.org/w/api.php?action=parse&page="
        + page_title
        + "&prop=wikitext&format=json&formatversion=2"
    )
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    return data["parse"]["wikitext"]


def parse_sp500(wikitext: str) -> list[str]:
    # The Symbol column on "List of S&P 500 companies" uses a
    # {{ticker|SYMBOL}} template call per row.
    return sorted(set(re.findall(r"\{\{ticker\|([A-Z.\-]+)\}\}", wikitext)))


def parse_tsx60(wikitext: str) -> list[str]:
    # The "S&P/TSX 60" wikitable has one column cell per line starting
    # with "| SYMBOL ||" or "| SYMBOL.TO ||".
    rows = []
    for line in wikitext.splitlines():
        m = re.match(r"^\|\s*([A-Z]{1,6}(?:\.[A-Z]{1,2})?)\s*\|\|", line)
        if m:
            rows.append(m.group(1))
    return sorted(set(rows))


def to_yahoo_symbol_us(sym: str) -> str:
    # BRK.B -> BRK-B (matches lib/symbol-normalize.ts convention)
    return sym.replace(".", "-")


def to_yahoo_symbol_tsx(sym: str) -> str:
    base = sym[:-3] if sym.endswith(".TO") else sym
    return f"{base.replace('.', '-')}.TO"


def main() -> None:
    sp500_raw = parse_sp500(fetch_wikitext("List_of_S%26P_500_companies"))
    tsx60_raw = parse_tsx60(fetch_wikitext("S%26P/TSX_60"))

    sp500 = [(to_yahoo_symbol_us(s), "US") for s in sp500_raw]
    tsx60 = [(to_yahoo_symbol_tsx(s), "TSX") for s in tsx60_raw]

    entries = sorted(set(sp500 + tsx60))

    if len(entries) < 400:
        raise SystemExit(
            f"Only parsed {len(entries)} tickers — Wikipedia table format "
            "likely changed. Inspect parse_sp500/parse_tsx60 before "
            "committing this output."
        )

    lines = [
        "// Auto-generated by scripts/generate-tickers.py — do not hand-edit.",
        "// Re-run the script to refresh when index constituents change.",
        "",
        'export type ScreenerExchange = "US" | "TSX";',
        "",
        "export type ScreenerTicker = {",
        "  symbol: string;",
        "  exchange: ScreenerExchange;",
        "};",
        "",
        "export const SCREENER_TICKERS: ScreenerTicker[] = [",
    ]
    for symbol, exchange in entries:
        lines.append(f'  {{ symbol: "{symbol}", exchange: "{exchange}" }},')
    lines.append("];")
    lines.append("")

    with open("lib/sp500-tsx60-tickers.ts", "w") as f:
        f.write("\n".join(lines))

    print(f"Wrote {len(entries)} tickers to lib/sp500-tsx60-tickers.ts")
    print(f"  S&P 500: {len(sp500)}, TSX 60: {len(tsx60)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the script from the project root**

Run: `cd /Users/tawfic/projects/intrinsic && python3 scripts/generate-tickers.py`
Expected: `Wrote NNN tickers to lib/sp500-tsx60-tickers.ts` where NNN is roughly 500-560 (S&P 500 has exactly 500 constituents but a handful of dual-class companies share one ticker prefix already deduped by `sorted(set(...))`; TSX 60 has 60). If the script raises `SystemExit` about the table format changing, open the fetched wikitext (add a temporary `print(wikitext[:2000])` inside `main()`) and adjust the regex in `parse_sp500`/`parse_tsx60` to match the current table structure, then re-run.

- [ ] **Step 3: Spot-check the generated file**

Run: `grep -E '"(AAPL|MSFT|BRK-B)"' lib/sp500-tsx60-tickers.ts`
Expected: three matching lines (AAPL, MSFT, BRK-B are permanent S&P 500 members).

Run: `grep -E '"(RY|TD)\.TO"' lib/sp500-tsx60-tickers.ts`
Expected: two matching lines (Royal Bank, TD Bank are permanent TSX 60 members).

- [ ] **Step 4: Typecheck the generated file**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-tickers.py lib/sp500-tsx60-tickers.ts
git commit -m "feat: add S&P 500 + TSX 60 ticker list generator and output"
```

---

### Task 2: Screener types

**Files:**
- Create: `lib/screener-types.ts`

**Interfaces:**
- Produces: `ScreenerFilterField`, `ScreenerFilterOperator`, `ScreenerFilter`, `ScreenerStockRow` types, and `SCREENER_FILTERABLE_FIELDS` / `SCREENER_FILTER_OPERATORS` whitelists. Consumed by Tasks 4, 5, 6, 7, 8, 9.

- [ ] **Step 1: Write the types file**

```typescript
export type ScreenerFilterField =
  | "margin_of_safety"
  | "valuation_label"
  | "market_cap"
  | "pe_ratio"
  | "forward_pe"
  | "revenue_growth"
  | "price";

export type ScreenerFilterOperator = "gt" | "gte" | "lt" | "lte" | "eq";

export type ScreenerFilter = {
  field: ScreenerFilterField;
  operator: ScreenerFilterOperator;
  value: number | string;
};

export type ScreenerValuationLabel = "Undervalued" | "Fair" | "Overvalued";

export type ScreenerStockRow = {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  intrinsic_value: number | null;
  margin_of_safety: number | null;
  valuation_label: ScreenerValuationLabel | null;
  market_cap: number | null;
  pe_ratio: number | null;
  forward_pe: number | null;
  revenue_growth: number | null;
  updated_at: string;
};

export const SCREENER_FILTERABLE_FIELDS: readonly ScreenerFilterField[] = [
  "margin_of_safety",
  "valuation_label",
  "market_cap",
  "pe_ratio",
  "forward_pe",
  "revenue_growth",
  "price",
] as const;

export const SCREENER_FILTER_OPERATORS: readonly ScreenerFilterOperator[] = [
  "gt",
  "gte",
  "lt",
  "lte",
  "eq",
] as const;

export const SCREENER_VALUATION_LABELS: readonly ScreenerValuationLabel[] = [
  "Undervalued",
  "Fair",
  "Overvalued",
] as const;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/screener-types.ts
git commit -m "feat: add screener filter and row types"
```

---

### Task 3: Supabase client, schema, and env wiring

**Files:**
- Create: `supabase/schema.sql`
- Create: `lib/supabase-client.ts`
- Modify: `.env.example`
- Modify: `package.json` (add `@supabase/supabase-js`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `getSupabaseServerClient(): SupabaseClient | null` — consumed by Tasks 6 and 7. Returns `null` when `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` aren't set (mirrors the existing fail-open-in-dev / fail-safe-in-prod pattern already used by `lib/rate-limit.ts`).

- [ ] **Step 1: Install the Supabase client**

Run: `npm install @supabase/supabase-js`
Expected: `package.json` gains a new dependency entry; installs cleanly.

- [ ] **Step 2: Write the schema file**

```sql
-- Run this once in the Supabase project's SQL editor (Database > SQL Editor).
-- One row per screener-tracked symbol, overwritten nightly by the cron job
-- at app/api/cron/refresh-screener/route.ts. No history is kept.

create table if not exists screener_stocks (
  symbol text primary key,
  name text not null,
  exchange text not null,
  price numeric not null,
  intrinsic_value numeric,
  margin_of_safety numeric,
  valuation_label text,
  market_cap numeric,
  pe_ratio numeric,
  forward_pe numeric,
  revenue_growth numeric,
  updated_at timestamptz not null default now()
);

create index if not exists screener_stocks_margin_of_safety_idx
  on screener_stocks (margin_of_safety);
create index if not exists screener_stocks_market_cap_idx
  on screener_stocks (market_cap);
create index if not exists screener_stocks_pe_ratio_idx
  on screener_stocks (pe_ratio);
```

- [ ] **Step 3: Write the Supabase client wrapper**

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Server-only client using the service-role key — bypasses row-level
 * security. Never import this from a "use client" component. Returns null
 * when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren't configured, so
 * callers can degrade gracefully instead of crashing.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return cached;
}
```

- [ ] **Step 4: Add env var placeholders**

Modify `.env.example`, appending after the Upstash section:

```
# Supabase — stores nightly-precomputed screener data (server-only keys,
# never exposed to the client).
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Bearer token Vercel Cron sends when triggering the nightly screener
# refresh job. Generate any random string, e.g. `openssl rand -hex 32`.
CRON_SECRET=
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (client construction is lazy and doesn't require real credentials to compile).

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql lib/supabase-client.ts .env.example package.json package-lock.json
git commit -m "feat: add Supabase client and screener_stocks schema"
```

- [ ] **Step 7: Manual step — create the Supabase project (not code, do this now so later tasks can be live-verified)**

1. Go to supabase.com, sign up/sign in, create a new project (free tier).
2. Open the SQL Editor, paste the contents of `supabase/schema.sql`, run it.
3. Go to Project Settings > API. Copy the "Project URL" (→ `SUPABASE_URL`) and the `service_role` secret key (→ `SUPABASE_SERVICE_ROLE_KEY` — **not** the `anon` key, which is client-safe but can't bypass row-level security for the cron upserts).
4. Generate a random string for `CRON_SECRET` (e.g. `openssl rand -hex 32` in a terminal).
5. Add all three to `.env.local` (not committed — already gitignored) and note them for the Vercel env var setup in Task 12.

---

### Task 4: Natural-language query parser

**Files:**
- Create: `lib/screener-nl-parse.ts`

**Interfaces:**
- Consumes: `ScreenerFilter`, `SCREENER_FILTERABLE_FIELDS`, `SCREENER_FILTER_OPERATORS`, `SCREENER_VALUATION_LABELS` from `lib/screener-types.ts` (Task 2).
- Produces: `parseScreenerQuery(query: string): Promise<ParseScreenerQueryResult>` where `ParseScreenerQueryResult = { ok: true; filters: ScreenerFilter[] } | { ok: false; reason: string }`. Consumed by Task 7.

- [ ] **Step 1: Write the parser**

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Live-verify against real Groq (GROQ_API_KEY already set from Phase 1)**

Create a temporary, uncommitted verification file:

```typescript
// scripts/tmp-verify-nl-parse.ts (temporary — delete after running)
import { parseScreenerQuery } from "../lib/screener-nl-parse";

async function main() {
  const cases = [
    "margin of safety above 20%, revenue growth above 10%, P/E below 30",
    "undervalued and market cap above 500 billion",
    "asdkjaskldj nonsense query",
  ];
  for (const c of cases) {
    const result = await parseScreenerQuery(c);
    console.log(JSON.stringify({ query: c, result }, null, 2));
  }
}

main();
```

Run: `npx tsx scripts/tmp-verify-nl-parse.ts`
Expected: first two cases return `{ ok: true, filters: [...] }` with correctly mapped fields (e.g. `margin_of_safety` >= 20, `revenue_growth` >= 0.10, `pe_ratio` < 30 for the first case). Third case returns `{ ok: false, reason: "..." }`.

- [ ] **Step 4: Delete the temporary verification file**

Run: `rm scripts/tmp-verify-nl-parse.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/screener-nl-parse.ts
git commit -m "feat: add Groq-based natural language screener query parser"
```

---

### Task 5: Supabase query builder

**Files:**
- Create: `lib/screener-query.ts`

**Interfaces:**
- Consumes: `ScreenerFilter`, `ScreenerStockRow` from `lib/screener-types.ts` (Task 2); `SupabaseClient` type from `@supabase/supabase-js` (Task 3).
- Produces: `runScreenerQuery(supabase: SupabaseClient, filters: ScreenerFilter[]): Promise<{ rows: ScreenerStockRow[] } | { error: string }>`. Consumed by Task 7.

- [ ] **Step 1: Write the query builder**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScreenerFilter, ScreenerStockRow } from "@/lib/screener-types";

export async function runScreenerQuery(
  supabase: SupabaseClient,
  filters: ScreenerFilter[],
): Promise<{ rows: ScreenerStockRow[] } | { error: string }> {
  let query = supabase.from("screener_stocks").select("*");

  for (const filter of filters) {
    switch (filter.operator) {
      case "gt":
        query = query.gt(filter.field, filter.value);
        break;
      case "gte":
        query = query.gte(filter.field, filter.value);
        break;
      case "lt":
        query = query.lt(filter.field, filter.value);
        break;
      case "lte":
        query = query.lte(filter.field, filter.value);
        break;
      case "eq":
        query = query.eq(filter.field, filter.value);
        break;
    }
  }

  const { data, error } = await query.order("margin_of_safety", {
    ascending: false,
    nullsFirst: false,
  });

  if (error) {
    return { error: error.message };
  }
  return { rows: (data ?? []) as ScreenerStockRow[] };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If Supabase's `PostgrestFilterBuilder` generic types complain about reassigning `query` across the switch branches, change `let query = ...` to keep the same declared type by adding an explicit type annotation: `let query = supabase.from("screener_stocks").select("*") as ReturnType<typeof supabase.from>["select"]` is unnecessary — instead, confirm the error message first: if it's a type-widening issue, the fix is to not reassign `query` per-branch and instead build a filters array of closures applied via `.reduce()`. Only make this change if `tsc` actually reports an error; the switch-based version above is expected to typecheck cleanly against `@supabase/supabase-js`'s builder API.)

- [ ] **Step 3: Commit**

```bash
git add lib/screener-query.ts
git commit -m "feat: add Supabase screener query builder"
```

---

### Task 6: Nightly cron job to refresh screener data

**Files:**
- Create: `lib/concurrency.ts`
- Create: `app/api/cron/refresh-screener/route.ts`

**Interfaces:**
- Consumes: `SCREENER_TICKERS` (Task 1), `getSupabaseServerClient` (Task 3), `computeStockPayloadFromYahoo` from `lib/yahoo-stock-payload.ts` (existing), `valuationLabelFromMargin` from `lib/valuation-label.ts` (existing).
- Produces: `processWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void>` in `lib/concurrency.ts`, reusable by any future batch job.

**Why concurrency matters here:** ~560 sequential Yahoo Finance calls would take well over Vercel's Hobby-plan serverless function duration ceiling (60s max via `export const maxDuration`). Running a bounded number of symbols in parallel keeps the whole nightly job comfortably under that ceiling (560 symbols / 20 concurrent ≈ 28 batches; each `computeStockPayloadFromYahoo` call is already two parallel Yahoo requests internally, typically well under 1s, so the job should finish in well under a minute).

- [ ] **Step 1: Write the concurrency helper**

```typescript
/**
 * Runs `worker` over `items` with at most `concurrency` in flight at once.
 * Used to batch the nightly screener refresh (~560 Yahoo Finance calls)
 * within Vercel's serverless function duration limit instead of running
 * them fully sequentially.
 */
export async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < items.length) {
      const current = items[index];
      index++;
      await worker(current);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runNext(),
  );
  await Promise.all(workers);
}
```

- [ ] **Step 2: Verify the concurrency helper in isolation (no network calls)**

Create a temporary, uncommitted verification file:

```typescript
// scripts/tmp-verify-concurrency.ts (temporary — delete after running)
import { processWithConcurrency } from "../lib/concurrency";

async function main() {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const results: number[] = [];
  const start = Date.now();

  await processWithConcurrency(items, 5, async (item) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    results.push(item);
  });

  const elapsedMs = Date.now() - start;
  console.log(`Processed ${results.length}/${items.length} items in ${elapsedMs}ms`);
  console.log(`All items processed: ${results.length === items.length}`);
  console.log(`Ran concurrently (elapsed should be ~200ms, not ~1000ms): ${elapsedMs < 500}`);
}

main();
```

Run: `npx tsx scripts/tmp-verify-concurrency.ts`
Expected: `Processed 20/20 items in ~200ms`, both boolean checks print `true`. (20 items / concurrency 5 = 4 sequential batches of 50ms each ≈ 200ms; if it ran fully sequentially it would take ~1000ms.)

- [ ] **Step 3: Delete the temporary verification file**

Run: `rm scripts/tmp-verify-concurrency.ts`

- [ ] **Step 4: Write the cron route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { processWithConcurrency } from "@/lib/concurrency";
import { SCREENER_TICKERS } from "@/lib/sp500-tsx60-tickers";
import { getSupabaseServerClient } from "@/lib/supabase-client";
import { valuationLabelFromMargin } from "@/lib/valuation-label";
import { computeStockPayloadFromYahoo } from "@/lib/yahoo-stock-payload";

export const dynamic = "force-dynamic";
// 60s is the Vercel Hobby-plan ceiling for `maxDuration`; the concurrency
// batching in lib/concurrency.ts keeps the full ~560-symbol run within it.
export const maxDuration = 60;

const CONCURRENCY = 20;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json(
      { error: true, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: true, message: "Supabase not configured" },
      { status: 500 },
    );
  }

  let succeeded = 0;
  const failed: string[] = [];

  await processWithConcurrency(SCREENER_TICKERS, CONCURRENCY, async (ticker) => {
    const payload = await computeStockPayloadFromYahoo(ticker.symbol);
    if (!payload) {
      failed.push(ticker.symbol);
      return;
    }

    const valuationLabel =
      payload.marginOfSafety !== null
        ? valuationLabelFromMargin(payload.marginOfSafety)
        : null;

    const { error } = await supabase.from("screener_stocks").upsert({
      symbol: payload.symbol,
      name: payload.name,
      exchange: ticker.exchange,
      price: payload.price,
      intrinsic_value: payload.intrinsicValue,
      margin_of_safety: payload.marginOfSafety,
      valuation_label: valuationLabel,
      market_cap: payload.marketCap,
      pe_ratio: payload.peRatio,
      forward_pe: payload.forwardPE,
      revenue_growth: payload.revenueGrowth,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      failed.push(ticker.symbol);
    } else {
      succeeded++;
    }
  });

  return NextResponse.json({ succeeded, failed: failed.length, failedSymbols: failed });
}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint lib/concurrency.ts app/api/cron/refresh-screener/route.ts`
Expected: no errors.

- [ ] **Step 6: Verify auth rejection (works even without Supabase configured yet)**

Run: `npm run dev` in one terminal, then in another:

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/refresh-screener`
Expected: `401` (no `CRON_SECRET` set locally yet, or set but no header sent — either way unauthorized).

- [ ] **Step 7: Commit**

```bash
git add lib/concurrency.ts app/api/cron/refresh-screener/route.ts
git commit -m "feat: add nightly screener refresh cron job"
```

---

### Task 7: Screener query API route

**Files:**
- Create: `app/api/screener/route.ts`
- Modify: `lib/rate-limit.ts:1-47` (generalize the rate limiter into a factory so the screener gets its own bucket instead of sharing the chatbot's)

**Interfaces:**
- Consumes: `parseScreenerQuery` (Task 4), `runScreenerQuery` (Task 5), `getSupabaseServerClient` (Task 3), `clientIdentifierFromRequest` (existing, unchanged) and a new `checkScreenerRateLimit` (this task) from `lib/rate-limit.ts`.
- Produces: `POST /api/screener` accepting `{ query: string }`, returning `{ filters: ScreenerFilter[], rows: ScreenerStockRow[] }` on success or `{ error: true, message: string }` otherwise. Consumed by Task 9.

- [ ] **Step 1: Generalize the rate limiter into a factory**

Read `lib/rate-limit.ts` first (it currently exports a single `checkChatRateLimit`). Replace its contents with:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  UPSTASH_URL && UPSTASH_TOKEN
    ? new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN })
    : null;

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

/**
 * Falls open only outside production (so local dev works without a Redis
 * instance). In production, missing Upstash config fails closed — otherwise
 * the free Groq key would be unprotected if the env vars were never set.
 */
function createRateLimiter(
  prefix: string,
  limit: number,
  window: `${number} ${"s" | "m" | "h" | "d"}`,
) {
  const ratelimit = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, window),
        prefix,
      })
    : null;

  return async function check(identifier: string): Promise<RateLimitResult> {
    if (!ratelimit) {
      if (process.env.NODE_ENV === "production") {
        return { success: false, remaining: 0, reset: 0 };
      }
      return { success: true, remaining: limit, reset: 0 };
    }
    const { success, remaining, reset } = await ratelimit.limit(identifier);
    return { success, remaining, reset };
  };
}

// 20 messages per hour per IP — generous for a real conversation, tight
// enough to protect the free Groq key from scripted abuse.
export const checkChatRateLimit = createRateLimiter("intrinsic:chat", 20, "1 h");

// Screener queries also call Groq for NL parsing, so use a comparable
// budget under a separate bucket — chat and screener usage shouldn't
// compete for the same quota.
export const checkScreenerRateLimit = createRateLimiter(
  "intrinsic:screener",
  20,
  "1 h",
);

/**
 * `x-vercel-forwarded-for` is set by Vercel's edge network and cannot be
 * spoofed by the client (Vercel strips any client-supplied header with that
 * name before it reaches the app). Plain `x-forwarded-for` is attacker-
 * controllable — a client can prepend a fake IP and Vercel appends the real
 * one after it — so it's only a fallback, taking the last (rightmost) entry.
 */
export function clientIdentifierFromRequest(request: Request): string {
  const headers = request.headers;
  const vercelForwardedFor = headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(",")[0].trim();
  }
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((p) => p.trim());
    return parts[parts.length - 1];
  }
  return headers.get("x-real-ip") ?? "unknown";
}
```

This is a pure refactor of the existing file (`checkChatRateLimit`'s behavior and `clientIdentifierFromRequest` are unchanged) — `app/api/chat/route.ts` needs no changes since it still imports `checkChatRateLimit` by the same name.

- [ ] **Step 2: Write the screener API route**

```typescript
import { NextResponse } from "next/server";
import { parseScreenerQuery } from "@/lib/screener-nl-parse";
import { runScreenerQuery } from "@/lib/screener-query";
import {
  checkScreenerRateLimit,
  clientIdentifierFromRequest,
} from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase-client";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 500;

type ScreenerRequestBody = { query: string };

function isScreenerRequestBody(json: unknown): json is ScreenerRequestBody {
  return (
    !!json &&
    typeof json === "object" &&
    typeof (json as Record<string, unknown>).query === "string"
  );
}

export async function POST(request: Request) {
  const identifier = clientIdentifierFromRequest(request);
  const rateLimit = await checkScreenerRateLimit(identifier);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: true,
        message: "You've hit the screener query limit for now. Try again in a bit.",
      },
      { status: 429 },
    );
  }

  const json: unknown = await request.json().catch(() => null);
  if (
    !isScreenerRequestBody(json) ||
    json.query.length === 0 ||
    json.query.length > MAX_QUERY_LENGTH
  ) {
    return NextResponse.json(
      { error: true, message: "Invalid request" },
      { status: 400 },
    );
  }

  const parsed = await parseScreenerQuery(json.query);
  if (!parsed.ok) {
    return NextResponse.json({ error: true, message: parsed.reason });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: true, message: "Screener temporarily unavailable." },
      { status: 503 },
    );
  }

  const result = await runScreenerQuery(supabase, parsed.filters);
  if ("error" in result) {
    return NextResponse.json(
      { error: true, message: "Screener temporarily unavailable." },
      { status: 503 },
    );
  }

  return NextResponse.json({ filters: parsed.filters, rows: result.rows });
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint lib/rate-limit.ts app/api/screener/route.ts app/api/chat/route.ts`
Expected: no errors.

- [ ] **Step 4: Verify the chat endpoint still works (rate-limit refactor didn't break it)**

Run: `npm run dev` (if not already running), then:

```bash
curl -s -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"id":"1","role":"user","parts":[{"type":"text","text":"one word: fair value?"}]}],
    "stockContext": {
      "symbol": "AAPL", "name": "Apple Inc.", "price": 230,
      "intrinsicValue": 260, "marginOfSafety": 13, "valuationLabel": "Fair",
      "growthRate": 0.08, "growthSource": "analyst", "discountRate": 0.06, "terminalGrowth": 0.025,
      "cashFlowSource": "freeCashflow", "marketCap": 3500000000000, "peRatio": 29, "forwardPE": 27,
      "revenueGrowth": 0.06, "week52High": 260, "week52Low": 165, "regulatoryNote": null, "news": []
    }
  }' --max-time 20
```

Expected: a streamed SSE response ending in `data: [DONE]`, same as before the refactor.

- [ ] **Step 5: Verify the screener endpoint's graceful-degradation path**

Run: `curl -s -X POST http://localhost:3000/api/screener -H "Content-Type: application/json" -d '{"query":"margin of safety above 20%"}'`
Expected: if `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` aren't set in `.env.local` yet, `{"error":true,"message":"Screener temporarily unavailable."}` with a 503. If Task 3's manual Supabase step is already done, this may instead return `{"filters":[...],"rows":[]}` (empty because the cron hasn't populated any data yet — that's expected until Task 12).

- [ ] **Step 6: Commit**

```bash
git add lib/rate-limit.ts app/api/screener/route.ts
git commit -m "feat: add screener query API route with its own rate-limit bucket"
```

---

### Task 8: Screener results table component

**Files:**
- Create: `components/ScreenerResultsTable.tsx`

**Interfaces:**
- Consumes: `ScreenerStockRow` from `lib/screener-types.ts` (Task 2); `formatCurrencyDisplay`, `formatPercentOneDecimal` from `lib/format-display.ts` (existing).
- Produces: `ScreenerResultsTable({ rows: ScreenerStockRow[] })` component. Consumed by Task 9.

- [ ] **Step 1: Write the component**

```tsx
import Link from "next/link";
import type { ScreenerStockRow } from "@/lib/screener-types";
import {
  formatCurrencyDisplay,
  formatPercentOneDecimal,
} from "@/lib/format-display";

type Props = {
  rows: ScreenerStockRow[];
};

function formatPe(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}x`;
}

function formatGrowth(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const pct = value * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function valuationLabelClass(label: ScreenerStockRow["valuation_label"]): string {
  switch (label) {
    case "Undervalued":
      return "bg-emerald-50/90 text-emerald-900/90 ring-1 ring-emerald-200/60";
    case "Overvalued":
      return "bg-rose-50/90 text-rose-900/85 ring-1 ring-rose-200/55";
    case "Fair":
      return "bg-stone-100/80 text-intrinsic-ink/85 ring-1 ring-intrinsic-secondary/20";
    default:
      return "bg-stone-100/60 text-intrinsic-secondary ring-1 ring-intrinsic-secondary/15";
  }
}

export function ScreenerResultsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-intrinsic-secondary">
        No stocks matched those conditions.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-intrinsic-secondary/10 bg-intrinsic-light shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-intrinsic-secondary/15 text-xs font-medium uppercase tracking-wide text-intrinsic-secondary">
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3 text-right">Price</th>
            <th className="px-4 py-3 text-right">Margin of safety</th>
            <th className="px-4 py-3">Valuation</th>
            <th className="px-4 py-3 text-right">P/E</th>
            <th className="px-4 py-3 text-right">Revenue growth</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.symbol}
              className="border-b border-intrinsic-secondary/10 last:border-b-0 hover:bg-intrinsic-bg/60"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/stock/${encodeURIComponent(row.symbol)}`}
                  className="font-semibold text-intrinsic-ink hover:underline"
                >
                  {row.symbol}
                </Link>
              </td>
              <td className="px-4 py-3 text-intrinsic-secondary">{row.name}</td>
              <td className="px-4 py-3 text-right tabular-nums text-intrinsic-ink">
                {formatCurrencyDisplay(row.price)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-intrinsic-ink">
                {row.margin_of_safety !== null
                  ? formatPercentOneDecimal(row.margin_of_safety)
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${valuationLabelClass(row.valuation_label)}`}
                >
                  {row.valuation_label ?? "—"}
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-intrinsic-ink">
                {formatPe(row.pe_ratio)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-intrinsic-ink">
                {formatGrowth(row.revenue_growth)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint components/ScreenerResultsTable.tsx`
Expected: no errors. (This component isn't rendered anywhere yet — full visual verification happens in Task 9.)

- [ ] **Step 3: Commit**

```bash
git add components/ScreenerResultsTable.tsx
git commit -m "feat: add screener results table component"
```

---

### Task 9: Screener page

**Files:**
- Create: `app/screener/page.tsx`

**Interfaces:**
- Consumes: `ScreenerResultsTable` (Task 8), `ScreenerStockRow` (Task 2). Calls `POST /api/screener` (Task 7).

- [ ] **Step 1: Write the page**

```tsx
"use client";

import { useState } from "react";
import { ScreenerResultsTable } from "@/components/ScreenerResultsTable";
import type { ScreenerStockRow } from "@/lib/screener-types";

const EXAMPLE_QUERIES = [
  "margin of safety above 20%, revenue growth above 10%, P/E below 30",
  "undervalued and P/E below 20",
  "market cap above 100 billion",
];

type ScreenerApiResponse = {
  error?: boolean;
  message?: string;
  rows?: ScreenerStockRow[];
};

export default function ScreenerPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ScreenerStockRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function runQuery(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!json || typeof json !== "object") {
        setError("Something went wrong. Try again.");
        setRows(null);
        return;
      }
      const o = json as ScreenerApiResponse;
      if (o.error) {
        setError(o.message ?? "Something went wrong.");
        setRows(null);
        return;
      }
      const resultRows = Array.isArray(o.rows) ? o.rows : [];
      setRows(resultRows);
      setLastUpdated(resultRows[0]?.updated_at ?? null);
    } catch {
      setError("Something went wrong. Try again.");
      setRows(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runQuery(query);
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
      <div className="w-full max-w-4xl">
        <h1 className="text-center text-3xl font-bold tracking-tight text-intrinsic-ink sm:text-4xl">
          Screener
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-intrinsic-secondary">
          Describe what you&apos;re looking for in plain English and screen
          the S&amp;P 500 and TSX 60 against it.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="margin of safety above 20%, revenue growth above 10%, P/E below 30"
            className="flex-1 rounded-full border border-intrinsic-secondary/25 bg-intrinsic-light px-5 py-3 text-sm text-intrinsic-ink placeholder:text-intrinsic-secondary/60 focus:border-[#A69486] focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-full bg-intrinsic-ink px-6 py-3 text-sm font-medium text-intrinsic-light transition-opacity duration-200 ease-out disabled:opacity-40"
          >
            {loading ? "Screening…" : "Screen"}
          </button>
        </form>

        {rows === null ? (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuery(example);
                  void runQuery(example);
                }}
                className="rounded-full border border-intrinsic-secondary/30 px-3 py-1.5 text-xs text-intrinsic-secondary transition-colors hover:bg-intrinsic-bg"
              >
                {example}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="mt-6 text-center text-sm text-rose-900/80">{error}</p>
        ) : null}

        {rows !== null && !error ? (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between text-xs text-intrinsic-secondary">
              <span>
                {rows.length} match{rows.length === 1 ? "" : "es"}
              </span>
              {lastUpdated ? (
                <span>
                  Data as of{" "}
                  {new Date(lastUpdated).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              ) : null}
            </div>
            <ScreenerResultsTable rows={rows} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint app/screener/page.tsx`
Expected: no errors.

- [ ] **Step 3: Browser verification**

Run: `npm run dev` (if not already running). Navigate to `http://localhost:3000/screener`, confirm the page renders with the input, submit button, and example query chips. Click an example chip; confirm either a results table (if Supabase is configured and populated) or the graceful error message (if not — expected until Task 12).

- [ ] **Step 4: Commit**

```bash
git add app/screener/page.tsx
git commit -m "feat: add screener page"
```

---

### Task 10: Navbar link

**Files:**
- Modify: `components/Navbar.tsx:15-24`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new (pure UI addition).

- [ ] **Step 1: Add the Screener link next to the logo**

In `components/Navbar.tsx`, replace:

```tsx
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link
            href={isSignedIn ? "/?home=1" : "/"}
            className="text-lg font-medium tracking-tight text-intrinsic-ink transition-colors hover:text-intrinsic-secondary sm:text-xl"
          >
            Intrinsic
          </Link>
```

with:

```tsx
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href={isSignedIn ? "/?home=1" : "/"}
              className="text-lg font-medium tracking-tight text-intrinsic-ink transition-colors hover:text-intrinsic-secondary sm:text-xl"
            >
              Intrinsic
            </Link>
            <Link
              href="/screener"
              className="text-sm font-medium text-intrinsic-secondary transition-colors hover:text-intrinsic-ink"
            >
              Screener
            </Link>
          </div>
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint components/Navbar.tsx`
Expected: no errors.

- [ ] **Step 3: Browser verification**

Navigate to `http://localhost:3000/explore` (or any page). Confirm "Screener" link appears next to "Intrinsic" in the navbar, regardless of sign-in state. Click it, confirm it navigates to `/screener`.

- [ ] **Step 4: Commit**

```bash
git add components/Navbar.tsx
git commit -m "feat: add Screener link to navbar"
```

---

### Task 11: Vercel Cron configuration

**Files:**
- Create: `vercel.json`

**Interfaces:**
- Consumes: nothing (config file).
- Produces: nothing (activates on next Vercel deploy).

- [ ] **Step 1: Write the cron config**

```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-screener",
      "schedule": "0 6 * * *"
    }
  ]
}
```

`0 6 * * *` runs daily at 06:00 UTC (after US market close, before the next trading day). Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron-triggered requests when the `CRON_SECRET` env var is set on the project — matches what `app/api/cron/refresh-screener/route.ts` (Task 6) checks.

- [ ] **Step 2: Validate the JSON**

Run: `python3 -m json.tool vercel.json`
Expected: pretty-printed JSON echoed back, no parse error.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat: schedule nightly screener refresh via Vercel Cron"
```

---

### Task 12: End-to-end integration with live Supabase

**Files:** none created — this task wires already-written code to live infrastructure and verifies the full flow.

**Prerequisite:** Task 3's manual step (Supabase project created, `schema.sql` run, `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`CRON_SECRET` in `.env.local`). If not done yet, do it now.

- [ ] **Step 1: Restart the dev server with the new env vars loaded**

Run: `pkill -f "next dev"; npm run dev`
Wait for it to report ready, then: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000` — expect `200`.

- [ ] **Step 2: Manually trigger the cron route locally against a real Yahoo/Supabase run**

Run:

```bash
CRON_SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2)
curl -s -X GET http://localhost:3000/api/cron/refresh-screener \
  -H "Authorization: Bearer $CRON_SECRET" \
  --max-time 90
```

Expected: after up to ~60-90s, a JSON response like `{"succeeded":540,"failed":15,"failedSymbols":[...]}`. Some failures are expected (delisted/renamed tickers, temporary Yahoo hiccups) — `succeeded` should be the large majority of ~560.

- [ ] **Step 3: Spot-check the data landed in Supabase**

In the Supabase dashboard's Table Editor, open `screener_stocks`. Confirm it has ~500+ rows, and that a known symbol (e.g. `AAPL`) has non-null `price`, `intrinsic_value`, `margin_of_safety`.

- [ ] **Step 4: Verify the screener API end-to-end**

Run:

```bash
curl -s -X POST http://localhost:3000/api/screener \
  -H "Content-Type: application/json" \
  -d '{"query":"margin of safety above 10%, P/E below 40"}' | python3 -m json.tool
```

Expected: `{"filters":[...], "rows":[...]}` with one or more matching rows, each row's `margin_of_safety` >= 10 and `pe_ratio` < 40.

- [ ] **Step 5: Verify the screener page end-to-end in the browser**

Navigate to `http://localhost:3000/screener`. Click an example query chip. Confirm the results table renders with real symbols, prices, and valuation labels, and that clicking a symbol navigates to its `/stock/[symbol]` page with matching data.

- [ ] **Step 6: Set the three env vars on Vercel**

Vercel dashboard → `intrinsic` project → Settings → Environment Variables → add for Production (and Preview if desired):

```
SUPABASE_URL=<same value as .env.local>
SUPABASE_SERVICE_ROLE_KEY=<same value as .env.local>
CRON_SECRET=<same value as .env.local>
```

- [ ] **Step 7: Push and confirm the cron job registers**

```bash
git push origin feat/explore-visual-redesign
```

After Vercel finishes deploying, check the project's "Cron Jobs" tab (Settings → Cron Jobs) — confirm `/api/cron/refresh-screener` is listed with the `0 6 * * *` schedule. It will run at its next scheduled time; there is no manual "run now" trigger from the dashboard on most plans, so the first live nightly run is the real test of the deployed path — the local run in Step 2 already exercised the same code end-to-end.
