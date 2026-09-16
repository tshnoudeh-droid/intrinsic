import Link from "next/link";
import type { ScreenerStockRow } from "@/lib/screener-types";
import {
  formatCurrencyDisplay,
  formatPercentOneDecimal,
} from "@/lib/format-display";

type Props = {
  rows: ScreenerStockRow[];
};

function formatPe(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}x`;
}

function formatGrowth(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const pct = value * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function valuationLabelClass(label: ScreenerStockRow["valuation_label"]): string {
  switch (label) {
    case "Undervalued":
      return "bg-emerald-50/90 text-emerald-900/90 ring-1 ring-emerald-200/60";
    case "Overvalued":
      return "bg-rose-50/90 text-rose-900/85 ring-1 ring-rose-200/55";
    case "Fair":
      return "bg-stone-100/80 text-intrinsic-ink/85 ring-1 ring-intrinsic-secondary/20";
    default:
      return "bg-stone-100/60 text-intrinsic-secondary ring-1 ring-intrinsic-secondary/15";
  }
}

export function ScreenerResultsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-intrinsic-secondary">
        No stocks matched those conditions.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-intrinsic-secondary/10 bg-intrinsic-light shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-intrinsic-secondary/15 text-xs font-medium uppercase tracking-wide text-intrinsic-secondary">
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3 text-right">Price</th>
            <th className="px-4 py-3 text-right">Margin of safety</th>
            <th className="px-4 py-3">Valuation</th>
            <th className="px-4 py-3 text-right">P/E</th>
            <th className="px-4 py-3 text-right">Revenue growth</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.symbol}
              className="border-b border-intrinsic-secondary/10 last:border-b-0 hover:bg-intrinsic-bg/60"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/stock/${encodeURIComponent(row.symbol)}`}
                  className="font-semibold text-intrinsic-ink hover:underline"
                >
                  {row.symbol}
                </Link>
              </td>
              <td className="px-4 py-3 text-intrinsic-secondary">{row.name}</td>
              <td className="px-4 py-3 text-right tabular-nums text-intrinsic-ink">
                {formatCurrencyDisplay(row.price)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-intrinsic-ink">
                {row.margin_of_safety !== null
                  ? formatPercentOneDecimal(row.margin_of_safety)
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${valuationLabelClass(row.valuation_label)}`}
                >
                  {row.valuation_label ?? "—"}
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-intrinsic-ink">
                {formatPe(row.pe_ratio)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-intrinsic-ink">
                {formatGrowth(row.revenue_growth)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
