"use client";

import { useEffect, useState } from "react";

const CHUNK = 50;
/** Shared across screens in this tab so re-runs don't refetch. */
const known = new Map<string, string | null>();

async function fetchChunk(symbols: string[]): Promise<void> {
  const res = await fetch(
    `/api/screener/sectors?symbols=${encodeURIComponent(symbols.join(","))}`,
  );
  if (!res.ok) return;
  const json: unknown = await res.json().catch(() => null);
  const sectors =
    json && typeof json === "object"
      ? (json as { sectors?: unknown }).sectors
      : null;
  if (!sectors || typeof sectors !== "object") return;
  for (const [symbol, sector] of Object.entries(sectors)) {
    known.set(symbol, typeof sector === "string" ? sector : null);
  }
}

function snapshot(symbols: string[]): Record<string, string | null> | undefined {
  if (!symbols.every((s) => known.has(s))) return undefined;
  return Object.fromEntries(symbols.map((s) => [s, known.get(s) ?? null]));
}

/**
 * Sector per screener symbol (Yahoo, via /api/screener/sectors). Returns
 * undefined until every symbol is resolved, so sector chips/pills appear all
 * at once instead of reshuffling row by row.
 */
export function useScreenerSectors(
  symbols: string[],
): Record<string, string | null> | undefined {
  const key = [...symbols].sort().join(",");
  const [result, setResult] = useState<{
    key: string;
    sectors: Record<string, string | null> | undefined;
  }>({ key: "", sectors: undefined });

  useEffect(() => {
    if (!key) return;
    const list = key.split(",");
    const missing = list.filter((s) => !known.has(s));
    let cancelled = false;
    const chunks: string[][] = [];
    for (let i = 0; i < missing.length; i += CHUNK) {
      chunks.push(missing.slice(i, i + CHUNK));
    }
    void Promise.allSettled(chunks.map(fetchChunk)).then(() => {
      if (cancelled) return;
      // Unresolved symbols (failed chunk) count as "no sector".
      for (const s of list) if (!known.has(s)) known.set(s, null);
      setResult({ key, sectors: snapshot(list) });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) return undefined;
  if (result.key === key) return result.sectors;
  return snapshot(key.split(","));
}
