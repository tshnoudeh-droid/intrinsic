export type StockDetailPayload = {
  symbol: string;
  name: string;
  price: number;
  fcf: number | null;
  earnings: number | null;
  sharesOutstanding: number | null;
};
