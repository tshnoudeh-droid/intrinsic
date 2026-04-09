const STORAGE_PREFIX = "watchlist_";

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function notifyWatchlistChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("intrinsic-watchlist-changed"));
}

export function getWatchlist(userId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string")
      .map(normalizeSymbol);
  } catch {
    return [];
  }
}

export function addToWatchlist(userId: string, symbol: string): void {
  if (typeof window === "undefined") return;
  const sym = normalizeSymbol(symbol);
  if (!sym) return;
  const current = getWatchlist(userId);
  if (current.includes(sym)) return;
  const next = [...current, sym];
  localStorage.setItem(
    `${STORAGE_PREFIX}${userId}`,
    JSON.stringify(next),
  );
  notifyWatchlistChanged();
}

export function removeFromWatchlist(userId: string, symbol: string): void {
  if (typeof window === "undefined") return;
  const sym = normalizeSymbol(symbol);
  const next = getWatchlist(userId).filter((s) => s !== sym);
  localStorage.setItem(
    `${STORAGE_PREFIX}${userId}`,
    JSON.stringify(next),
  );
  notifyWatchlistChanged();
}

export function isInWatchlist(userId: string, symbol: string): boolean {
  const sym = normalizeSymbol(symbol);
  return getWatchlist(userId).includes(sym);
}
