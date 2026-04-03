import type { HistoryPoint, HistoryRange } from "@/lib/history-types";

function parseHistoryPayload(json: unknown): HistoryPoint[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (row): row is HistoryPoint =>
      row !== null &&
      typeof row === "object" &&
      "date" in row &&
      "price" in row &&
      typeof (row as HistoryPoint).date === "string" &&
      typeof (row as HistoryPoint).price === "number",
  );
}

export type FetchStockHistoryResult =
  | { ok: true; points: HistoryPoint[] }
  | { ok: false; error: "http" | "network" | "bad_payload" };

/**
 * Loads candle history from the app API (Finnhub-backed). Does not hardcode a symbol.
 */
export async function fetchStockHistory(
  symbol: string,
  range: HistoryRange,
): Promise<FetchStockHistoryResult> {
  const trimmed = symbol.trim();
  if (!trimmed) {
    return { ok: true, points: [] };
  }

  const url = `/api/history?symbol=${encodeURIComponent(trimmed)}&range=${encodeURIComponent(range)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, error: "http" };
    }
    const json: unknown = await res.json();
    if (!Array.isArray(json)) {
      return { ok: false, error: "bad_payload" };
    }
    return { ok: true, points: parseHistoryPayload(json) };
  } catch {
    return { ok: false, error: "network" };
  }
}
