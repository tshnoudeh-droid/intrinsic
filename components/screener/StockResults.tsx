"use client";

import { useMemo, useState } from "react";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { StockResultCard } from "@/components/screener/StockResultCard";
import { useScreenerSectors } from "@/lib/screener-sectors-client";
import type { ScreenerStockRow } from "@/lib/screener-types";

export type StockSortKey = "safety" | "pe" | "marketCap" | "growth";

const SORT_OPTIONS: { key: StockSortKey; label: string }[] = [
  { key: "safety", label: "Margin of safety" },
  { key: "pe", label: "Lowest P/E" },
  { key: "marketCap", label: "Largest" },
  { key: "growth", label: "Growth" },
];

const PAGE_SIZE = 20;

function usable(v: number | null): v is number {
  return v !== null && Number.isFinite(v);
}

/** Descending by `get`, missing values last. */
function byDesc(get: (r: ScreenerStockRow) => number | null) {
  return (a: ScreenerStockRow, b: ScreenerStockRow) => {
    const x = get(a);
    const y = get(b);
    if (!usable(x)) return usable(y) ? 1 : 0;
    if (!usable(y)) return -1;
    return y - x;
  };
}

export function sortStockRows(rows: ScreenerStockRow[], key: StockSortKey): ScreenerStockRow[] {
  const copy = [...rows];
  switch (key) {
    case "safety":
      return copy.sort(byDesc((r) => r.margin_of_safety));
    case "marketCap":
      return copy.sort(byDesc((r) => r.market_cap));
    case "growth":
      return copy.sort(byDesc((r) => r.revenue_growth));
    case "pe":
      // Lowest positive P/E first; negative / missing P/E last.
      return copy.sort(byDesc((r) => (usable(r.pe_ratio) && r.pe_ratio > 0 ? -r.pe_ratio : null)));
  }
}

type Props = {
  rows: ScreenerStockRow[];
};

export function StockResults({ rows }: Props) {
  const symbols = useMemo(() => rows.map((r) => r.symbol), [rows]);
  // symbol → sector (Yahoo); undefined until resolved.
  const sectors = useScreenerSectors(symbols);
  const [sort, setSort] = useState<StockSortKey>("safety");
  const [sector, setSector] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const sectorCounts = useMemo(() => {
    if (!sectors) return [];
    const counts = new Map<string, number>();
    for (const r of rows) {
      const s = sectors[r.symbol];
      if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, sectors]);

  const sorted = useMemo(() => {
    const filtered =
      sector && sectors ? rows.filter((r) => sectors[r.symbol] === sector) : rows;
    return sortStockRows(filtered, sort);
  }, [rows, sort, sector, sectors]);

  const shown = sorted.slice(0, visible);

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        {sectorCounts.length > 1 ? (
          <div className="-mx-4 flex min-w-0 gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 sm:[mask-image:linear-gradient(to_right,black_92%,transparent)]" role="group" aria-label="Filter by sector">
            <SectorPill active={sector === null} onClick={() => setSector(null)}>
              All <span className="text-intrinsic-secondary">{rows.length}</span>
            </SectorPill>
            {sectorCounts.map(([name, count]) => (
              <SectorPill
                key={name}
                active={sector === name}
                onClick={() => {
                  setSector(sector === name ? null : name);
                  setVisible(PAGE_SIZE);
                }}
              >
                {name} <span className="text-intrinsic-secondary">{count}</span>
              </SectorPill>
            ))}
          </div>
        ) : (
          <span />
        )}
        <label className="flex shrink-0 items-center gap-2 self-end text-xs text-intrinsic-secondary sm:self-auto">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as StockSortKey)}
            className="h-8 rounded-full border border-intrinsic-secondary/25 bg-intrinsic-light px-3 text-xs font-medium text-intrinsic-ink focus:border-intrinsic-secondary focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="divide-y divide-intrinsic-secondary/10 overflow-hidden rounded-3xl border border-intrinsic-secondary/12 bg-intrinsic-light shadow-[0_1px_2px_rgba(42,38,34,0.04)]">
        {shown.map((row) => (
          <StockResultCard key={row.symbol} row={row} sector={sectors?.[row.symbol] ?? null} />
        ))}
      </ul>

      <p className="mt-3 px-1 text-xs leading-relaxed text-intrinsic-secondary">
        What these mean: <GlossaryTerm term="margin-of-safety">Safety</GlossaryTerm> ·{" "}
        <GlossaryTerm term="pe">P/E</GlossaryTerm> ·{" "}
        <GlossaryTerm term="revenue-growth">Growth</GlossaryTerm> ·{" "}
        <GlossaryTerm term="market-cap" /> · <GlossaryTerm term="valuation" />
      </p>

      {sorted.length > visible ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-full border border-intrinsic-secondary/25 bg-intrinsic-light px-5 py-2 text-sm font-medium text-intrinsic-ink transition-colors hover:bg-intrinsic-bg"
          >
            Show more · {sorted.length - visible} left
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SectorPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors ${
        active
          ? "bg-intrinsic-ink text-intrinsic-light [&>span]:text-intrinsic-light/60"
          : "border border-intrinsic-secondary/20 bg-intrinsic-light text-intrinsic-ink hover:bg-intrinsic-bg"
      }`}
    >
      {children}
    </button>
  );
}
