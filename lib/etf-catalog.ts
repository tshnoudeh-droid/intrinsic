import type { EtfCategory } from "@/lib/screener-types";

/**
 * Hand-picked, widely held broad US and Canadian ETFs. Symbols and our own
 * category labels only — every number (price, fees, yield, returns) is
 * fetched live from Yahoo in lib/etf-data.ts.
 */

export const ETF_CATEGORY_LABELS: Record<EtfCategory, string> = {
  "all-in-one": "All-in-one portfolio",
  "us-total-market": "US total market",
  sp500: "S&P 500",
  "canadian-equity": "Canadian equity",
  international: "International",
  dividend: "Dividend",
  bonds: "Bonds",
  growth: "Growth / Nasdaq-100",
};

/** Default display order when the query doesn't point at specific groups. */
export const DEFAULT_ETF_CATEGORY_ORDER: EtfCategory[] = [
  "all-in-one",
  "us-total-market",
  "sp500",
  "canadian-equity",
  "international",
  "dividend",
  "bonds",
  "growth",
];

export type EtfCatalogEntry = { symbol: string; category: EtfCategory };

export const ETF_CATALOG: readonly EtfCatalogEntry[] = [
  { symbol: "XEQT.TO", category: "all-in-one" },
  { symbol: "VEQT.TO", category: "all-in-one" },
  { symbol: "XGRO.TO", category: "all-in-one" },
  { symbol: "VGRO.TO", category: "all-in-one" },
  { symbol: "XBAL.TO", category: "all-in-one" },
  { symbol: "VBAL.TO", category: "all-in-one" },
  { symbol: "VTI", category: "us-total-market" },
  { symbol: "ITOT", category: "us-total-market" },
  { symbol: "XUU.TO", category: "us-total-market" },
  { symbol: "VOO", category: "sp500" },
  { symbol: "IVV", category: "sp500" },
  { symbol: "SPY", category: "sp500" },
  { symbol: "VFV.TO", category: "sp500" },
  { symbol: "ZSP.TO", category: "sp500" },
  { symbol: "XIC.TO", category: "canadian-equity" },
  { symbol: "VCN.TO", category: "canadian-equity" },
  { symbol: "ZCN.TO", category: "canadian-equity" },
  { symbol: "XIU.TO", category: "canadian-equity" },
  { symbol: "VXUS", category: "international" },
  { symbol: "VEA", category: "international" },
  { symbol: "XEF.TO", category: "international" },
  { symbol: "XAW.TO", category: "international" },
  { symbol: "SCHD", category: "dividend" },
  { symbol: "VYM", category: "dividend" },
  { symbol: "VIG", category: "dividend" },
  { symbol: "XEI.TO", category: "dividend" },
  { symbol: "VDY.TO", category: "dividend" },
  { symbol: "CDZ.TO", category: "dividend" },
  { symbol: "BND", category: "bonds" },
  { symbol: "AGG", category: "bonds" },
  { symbol: "ZAG.TO", category: "bonds" },
  { symbol: "XBB.TO", category: "bonds" },
  { symbol: "QQQ", category: "growth" },
];
