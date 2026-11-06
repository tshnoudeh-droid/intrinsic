/** Small illustrative previews for the homepage product cards (no live data). */

export function ValuatorPreview() {
  return (
    <div
      aria-hidden
      className="relative overflow-hidden rounded-2xl border border-intrinsic-secondary/15 bg-white/70 p-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-intrinsic-secondary">
            Price vs. intrinsic value
          </p>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-intrinsic-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-intrinsic-ink" />
              Price
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-intrinsic-secondary" />
              Intrinsic value
            </span>
          </div>
        </div>
        <span className="rounded-full bg-intrinsic-accent px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
          Undervalued
        </span>
      </div>
      <svg
        viewBox="0 0 280 80"
        preserveAspectRatio="none"
        className="mt-4 h-20 w-full"
        fill="none"
      >
        <line
          x1="0"
          y1="18"
          x2="280"
          y2="18"
          stroke="#A69486"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points="0,66 25,60 50,68 75,54 100,58 125,46 150,52 175,42 200,48 225,36 250,40 280,32"
          stroke="#2a2622"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

const SCREENER_CHIPS = ["valuation = Undervalued", "P/E < 20"];

export function ScreenerPreview() {
  return (
    <div
      aria-hidden
      className="relative overflow-hidden rounded-2xl border border-intrinsic-secondary/15 bg-white/70 p-4"
    >
      <div className="flex items-center gap-2 rounded-full border border-intrinsic-secondary/20 bg-intrinsic-light px-3.5 py-2 text-[13px] text-intrinsic-ink">
        <span className="truncate">undervalued and P/E below 20</span>
        <span className="ml-auto h-4 w-px animate-pulse bg-intrinsic-ink/60" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SCREENER_CHIPS.map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-intrinsic-bg px-2.5 py-1 text-[11px] font-medium text-intrinsic-ink-soft"
          >
            {chip}
          </span>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {[0.9, 0.75, 0.6].map((w) => (
          <div key={w} className="flex items-center gap-3">
            <span className="h-2.5 w-10 rounded-full bg-intrinsic-ink/70" />
            <span
              className="h-2 rounded-full bg-intrinsic-secondary/30"
              style={{ width: `${w * 60}%` }}
            />
            <span className="ml-auto h-2 w-8 rounded-full bg-intrinsic-accent" />
          </div>
        ))}
      </div>
    </div>
  );
}
