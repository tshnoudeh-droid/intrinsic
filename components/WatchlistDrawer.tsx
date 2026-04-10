"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatCurrencyDisplay } from "@/lib/format-display";
import { getWatchlist, removeFromWatchlist } from "@/lib/watchlist";

type WatchlistDataItem = {
  symbol: string;
  name: string;
  price: number;
  intrinsicValue: number | null;
  marginOfSafety: number | null;
  label: "Undervalued" | "Fair" | "Overvalued" | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
};

function labelClass(
  label: "Undervalued" | "Fair" | "Overvalued" | null,
): string {
  if (label === "Undervalued") return "text-[#16a34a]";
  if (label === "Overvalued") return "text-[#dc2626]";
  if (label === "Fair") return "text-[#A69486]";
  return "text-intrinsic-secondary";
}

export function WatchlistDrawer({ isOpen, onClose, userId }: Props) {
  const router = useRouter();
  const [symbols, setSymbols] = useState<string[]>([]);
  const [rows, setRows] = useState<(WatchlistDataItem | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!userId) {
      setSymbols([]);
      setRows([]);
      return;
    }
    const list = getWatchlist(userId);
    setSymbols(list);
    if (list.length === 0) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/watchlist-data?symbols=${encodeURIComponent(list.join(","))}`,
        { cache: "no-store" },
      );
      const data: unknown = await res.json().catch(() => null);
      if (!Array.isArray(data)) {
        setRows([]);
        return;
      }
      setRows(
        data.map((cell) => {
          if (
            cell === null ||
            typeof cell !== "object" ||
            !("symbol" in cell) ||
            typeof (cell as WatchlistDataItem).symbol !== "string"
          ) {
            return null;
          }
          return cell as WatchlistDataItem;
        }),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isOpen || !userId) return;
    load();
  }, [isOpen, userId, tick, load]);

  useEffect(() => {
    const onList = () => setTick((t) => t + 1);
    window.addEventListener("intrinsic-watchlist-changed", onList);
    return () =>
      window.removeEventListener("intrinsic-watchlist-changed", onList);
  }, []);

  const handleRemove = (e: React.MouseEvent, sym: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) return;
    removeFromWatchlist(userId, sym);
    setTick((t) => t + 1);
  };

  const goToStock = (sym: string) => {
    onClose();
    router.push(`/stock/${encodeURIComponent(sym)}`);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="Close watchlist"
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ease-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed right-0 top-0 z-[101] flex h-full w-full max-w-none flex-col border-l border-intrinsic-secondary/15 bg-[#FAF8F4] shadow-xl transition-transform duration-300 ease-out md:w-[360px] md:max-w-[360px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-intrinsic-secondary/15 px-4 py-4">
          <h2 className="text-lg font-semibold text-intrinsic-ink">
            Watchlist
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-intrinsic-secondary transition-colors hover:bg-intrinsic-secondary/10 hover:text-intrinsic-ink"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
          {userId === null ? (
            <div className="px-2 text-center">
              <p className="text-sm text-intrinsic-ink">
                Sign in to start building your watchlist.
              </p>
              <Link
                href="/sign-in"
                className="mt-3 inline-block text-sm font-medium text-[#A69486] underline-offset-2 hover:underline"
              >
                Sign in
              </Link>
            </div>
          ) : symbols.length === 0 ? (
            <div className="px-2 text-center text-sm text-intrinsic-secondary">
              <p>No stocks saved yet.</p>
              <p className="mt-2">
                Search for a stock and tap the ★ to save it.
              </p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-12">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-[#A69486] border-t-transparent"
                aria-hidden
              />
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {symbols.map((sym, i) => {
                const row = rows[i] ?? null;
                return (
                  <li key={sym}>
                    <div className="relative flex w-full items-stretch">
                      <button
                        type="button"
                        onClick={() => goToStock(sym)}
                        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors duration-150 hover:bg-[#EDE8DF]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-intrinsic-ink">
                            {sym}
                          </p>
                          <p className="mt-0.5 text-xs text-intrinsic-secondary">
                            {row?.name ?? (row === null ? "—" : "…")}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold tabular-nums text-intrinsic-ink">
                            {row ? formatCurrencyDisplay(row.price) : "—"}
                          </p>
                          {row?.label ? (
                            <p
                              className={`mt-0.5 text-xs font-medium ${labelClass(row.label)}`}
                            >
                              {row.label}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs font-medium text-intrinsic-secondary/80">
                              —
                            </p>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${sym} from watchlist`}
                        onClick={(e) => handleRemove(e, sym)}
                        className="flex shrink-0 items-center justify-center px-2 text-intrinsic-secondary/70 transition-colors hover:text-intrinsic-ink"
                      >
                        <X className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
