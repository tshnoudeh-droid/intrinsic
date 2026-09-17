-- Run this once in the Supabase project's SQL editor (Database > SQL Editor).
-- One row per screener-tracked symbol, overwritten nightly by the cron job
-- at app/api/cron/refresh-screener/route.ts. No history is kept.

create table if not exists screener_stocks (
  symbol text primary key,
  name text not null,
  exchange text not null, -- "US" or "TSX", set from lib/sp500-tsx60-tickers.ts
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
