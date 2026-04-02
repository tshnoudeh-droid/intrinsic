export type StockDetailPayload = {
  symbol: string;
  name: string;
  price: number;
  intrinsicValue: number | null;
};

export type StockApiError = {
  error: true;
};
