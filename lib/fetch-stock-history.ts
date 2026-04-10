import type { HistoryPoint, HistoryRange } from "@/lib/history-types";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseHistoryPayload(json: unknown): HistoryPoint[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (row): row is HistoryPoint =>
      row !== null &&
      typeof row === "object" &&
      "date" in row &&
      "price" in row &&
      typeof (row as HistoryPoint).date === "string" &&
      ISO_DAY.test((row as HistoryPoint).date) &&
      typeof (row as HistoryPoint).price === "number",
  );
}

export type FetchStockHistoryResult =
  | { ok: true; points: HistoryPoint[] }
  | { ok: false; error: "http" | "network" | "bad_payload" };

/**
 * Loads daily history from `/api/history` (Yahoo Finance via server). Does not hardcode a symbol.
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
    const res = await fetch(url, { cache: "no-store" });
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
