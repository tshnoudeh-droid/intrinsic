export type HistoryPoint = {
  date: string;
  price: number;
};

/** Query param values for `/api/history` (Finnhub-style). */
export type HistoryRange = "1M" | "3M" | "1Y";
