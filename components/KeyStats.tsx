import type { StockDetailPayload } from "@/lib/stock-detail-types";

type Props = Pick<
  StockDetailPayload,
  | "marketCap"
  | "peRatio"
  | "forwardPE"
  | "revenueGrowth"
  | "week52High"
  | "week52Low"
>;

function formatMarketCap(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (abs >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatPe(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}x`;
}

function formatRevenueGrowth(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function formatWeekPrice(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type StatRow = { label: string; value: string };

export function KeyStats(props: Props) {
  const rows: StatRow[] = [
    {
      label: "Market Cap",
      value: props.marketCap !== null ? formatMarketCap(props.marketCap) : "—",
    },
    {
      label: "P/E Ratio (trailing)",
      value: props.peRatio !== null ? formatPe(props.peRatio) : "—",
    },
    {
      label: "Forward P/E",
      value: props.forwardPE !== null ? formatPe(props.forwardPE) : "—",
    },
    {
      label: "Revenue Growth",
      value:
        props.revenueGrowth !== null
          ? formatRevenueGrowth(props.revenueGrowth)
          : "—",
    },
    {
      label: "52W High",
      value: props.week52High !== null ? formatWeekPrice(props.week52High) : "—",
    },
    {
      label: "52W Low",
      value: props.week52Low !== null ? formatWeekPrice(props.week52Low) : "—",
    },
  ];

  return (
    <section
      className="rounded-2xl border border-intrinsic-secondary/10 bg-intrinsic-light px-6 py-6 shadow-sm sm:rounded-3xl sm:px-8 sm:py-7"
      aria-label="Key statistics"
    >
      <p className="mb-5 text-center text-xs font-medium uppercase tracking-widest text-intrinsic-secondary">
        Key stats
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:gap-x-10 sm:gap-y-6">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-widest text-intrinsic-secondary/90">
              {row.label}
            </p>
            <p className="mt-1.5 text-lg font-semibold tabular-nums text-intrinsic-ink sm:text-xl">
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
