"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import type { StockSearchResult } from "@/lib/search-types";

const DEBOUNCE_MS = 400;

export function SearchBar() {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-listbox`;
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      queueMicrotask(() => {
        startTransition(() => {
          setResults([]);
          setLoading(false);
          setUnavailable(false);
        });
      });
      return;
    }

    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setUnavailable(false);
    });

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(async (res) => {
        const data: unknown = await res.json();
        if (cancelled) return;
        if (res.status === 503) {
          setUnavailable(true);
          setResults([]);
          return;
        }
        if (!res.ok) {
          setResults([]);
          return;
        }
        if (!Array.isArray(data)) {
          setResults([]);
          return;
        }
        setResults(
          data.filter(
            (row): row is StockSearchResult =>
              row !== null &&
              typeof row === "object" &&
              "symbol" in row &&
              typeof (row as StockSearchResult).symbol === "string",
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) {
          startTransition(() => setLoading(false));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, startTransition]);

  const clearBlurTimer = useCallback(() => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearBlurTimer();
    blurTimer.current = setTimeout(() => setOpen(false), 180);
  }, [clearBlurTimer]);

  const handleFocus = useCallback(() => {
    clearBlurTimer();
    setOpen(true);
  }, [clearBlurTimer]);

  const handleBlur = useCallback(() => {
    scheduleClose();
  }, [scheduleClose]);

  const handleSelect = useCallback(
    (symbol: string) => {
      clearBlurTimer();
      setOpen(false);
      setQuery("");
      setDebouncedQuery("");
      setResults([]);
      setUnavailable(false);
      router.push(`/stock/${encodeURIComponent(symbol)}`);
    },
    [clearBlurTimer, router],
  );

  const trimmed = query.trim();
  const isDebouncing = trimmed !== debouncedQuery;
  const showSearching = isDebouncing || loading;
  const showDropdown = open && trimmed.length > 0;
  const showEmpty =
    showDropdown &&
    !showSearching &&
    !unavailable &&
    debouncedQuery.length > 0 &&
    results.length === 0;
  const showList =
    showDropdown && !showSearching && !unavailable && results.length > 0;

  return (
    <div className="relative w-full max-w-xl">
      <label htmlFor="stock-search" className="sr-only">
        Search for a stock
      </label>
      <input
        id="stock-search"
        type="search"
        name="stock-search"
        placeholder="Search for a stock (e.g. AAPL, TSLA, SHOP)"
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-full rounded-2xl border border-intrinsic-secondary/25 bg-intrinsic-light px-4 py-3.5 text-base text-intrinsic-ink shadow-sm placeholder:text-intrinsic-secondary/70 outline-none transition-[border-color,box-shadow,transform] duration-200 ease-out focus:border-intrinsic-secondary/40 focus:ring-2 focus:ring-intrinsic-accent focus:ring-offset-2 focus:ring-offset-intrinsic-bg sm:px-5 sm:py-4 sm:text-lg"
      />

      {showDropdown ? (
        <div
          id={listId}
          role="listbox"
          className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-intrinsic-secondary/15 bg-white shadow-lg"
        >
          {unavailable ? (
            <div className="px-4 py-3 text-sm text-intrinsic-secondary">
              Search is temporarily unavailable.
            </div>
          ) : null}

          {!unavailable && showSearching ? (
            <div className="px-4 py-3 text-sm text-intrinsic-secondary">
              Searching...
            </div>
          ) : null}

          {showEmpty ? (
            <div className="px-4 py-3 text-sm text-intrinsic-secondary">
              No results found
            </div>
          ) : null}

          {showList
            ? results.map((row) => (
                <button
                  key={`${row.symbol}-${row.description}`}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors duration-200 ease-out hover:bg-intrinsic-light active:bg-intrinsic-accent/30"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(row.symbol);
                  }}
                >
                  <span className="font-semibold text-intrinsic-ink">
                    {row.symbol}
                  </span>
                  <span className="text-sm font-normal text-intrinsic-secondary">
                    {row.description || "—"}
                  </span>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
