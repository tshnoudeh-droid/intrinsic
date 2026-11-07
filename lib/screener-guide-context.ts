import { sortStockRows } from "@/components/screener/StockResults";
import type { ChatScreenerContext } from "@/lib/chat-screener-context";
import {
  currencyForExchange,
  formatFilterChip,
  formatGrowth,
  formatMarginOfSafety,
  formatMarketCap,
  formatPe,
  formatPercentDecimal,
  formatPrice,
} from "@/lib/screener-format";
import type {
  ScreenerEtfRow,
  ScreenerFilter,
  ScreenerIntent,
  ScreenerStockRow,
} from "@/lib/screener-types";

const TOP_N = 8;

/** Builds the (already formatted) snapshot the AI guide sends with each message. */
export function buildScreenerChatContext(
  screen: {
    query: string;
    filters: ScreenerFilter[];
    intent: ScreenerIntent;
    rows: ScreenerStockRow[];
  } | null,
  etfs: ScreenerEtfRow[] | null,
): ChatScreenerContext {
  if (!screen) {
    return { query: "", filters: [], assetTypes: [], stockCount: 0, stocks: [], etfs: [] };
  }
  const preferred = screen.intent.etfCategories ?? [];
  const etfList = (etfs ?? [])
    .filter((e) => preferred.length === 0 || preferred.includes(e.category))
    .slice(0, TOP_N);

  return {
    query: screen.query,
    filters: screen.filters.map(formatFilterChip),
    assetTypes: screen.intent.assetTypes,
    stockCount: screen.rows.length,
    stocks: sortStockRows(screen.rows, "safety")
      .slice(0, TOP_N)
      .map((r) => {
        const currency = currencyForExchange(r.exchange);
        return {
          symbol: r.symbol,
          name: r.name,
          sector: null,
          price: formatPrice(r.price, currency),
          marginOfSafety: formatMarginOfSafety(r.margin_of_safety),
          valuationLabel: r.valuation_label,
          peRatio: formatPe(r.pe_ratio),
          revenueGrowth: formatGrowth(r.revenue_growth),
          marketCap: formatMarketCap(r.market_cap, currency),
        };
      }),
    etfs: etfList.map((e) => ({
      symbol: e.symbol,
      name: e.name,
      category: e.categoryLabel,
      expenseRatio: formatPercentDecimal(e.expenseRatio),
      dividendYield: formatPercentDecimal(e.dividendYield),
      ytdReturn: formatPercentDecimal(e.ytdReturn, { signed: true, digits: 1 }),
    })),
  };
}
