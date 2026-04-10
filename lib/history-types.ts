/** `date` is ISO calendar day `YYYY-MM-DD` (unique x-axis key; avoids duplicate month/day labels). */
export type HistoryPoint = {
  date: string;
  price: number;
};

/** Query param values for `/api/history`. */
export type HistoryRange = "1M" | "3M" | "1Y";
