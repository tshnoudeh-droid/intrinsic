"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import {
  formatCompactMoney,
  formatPercentFromDecimal,
  type CompanyProfile,
} from "@/lib/company-profile-client";

type Props = {
  profile: CompanyProfile;
  /** Larger type for the stock page; compact for popovers. */
  size?: "compact" | "comfortable";
};

function websiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isFund(profile: CompanyProfile): boolean {
  return profile.fund !== null;
}

function Chips({ profile }: { profile: CompanyProfile }) {
  const chips = isFund(profile)
    ? [
        profile.quoteType === "ETF" ? "ETF" : "Fund",
        profile.fund?.category ?? null,
      ]
    : [profile.sector, profile.industry];
  const visible = chips.filter((c): c is string => Boolean(c));
  if (visible.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Classification">
      {visible.map((chip) => (
        <li
          key={chip}
          className="rounded-full bg-intrinsic-accent/80 px-2.5 py-1 text-[11px] font-medium leading-none text-[#3d5a4c] ring-1 ring-[#b9dccb]/60"
        >
          {chip}
        </li>
      ))}
    </ul>
  );
}

function FundFacts({ profile }: { profile: CompanyProfile }) {
  const fund = profile.fund;
  if (!fund) return null;
  const facts = [
    { label: "Expense ratio", value: formatPercentFromDecimal(fund.expenseRatio) },
    { label: "Total assets", value: formatCompactMoney(fund.totalAssets, profile.currency) },
    { label: "Yield", value: formatPercentFromDecimal(fund.yield) },
    { label: "YTD return", value: formatPercentFromDecimal(fund.ytdReturn, 1) },
  ].filter((f): f is { label: string; value: string } => f.value !== null);

  return (
    <div className="space-y-3">
      {facts.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-intrinsic-bg/55 px-3.5 py-3">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-intrinsic-secondary">
                {f.label}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-intrinsic-ink">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {fund.fundFamily ? (
        <p className="text-xs text-intrinsic-secondary">
          Managed by <span className="text-intrinsic-ink/85">{fund.fundFamily}</span>
        </p>
      ) : null}
      {fund.topHoldings.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-intrinsic-secondary">
            Top holdings
          </p>
          <ul className="divide-y divide-intrinsic-secondary/10">
            {fund.topHoldings.map((h) => (
              <li
                key={`${h.symbol ?? ""}-${h.name}`}
                className="flex items-center justify-between gap-3 py-1.5 text-[13px]"
              >
                <span className="min-w-0 truncate text-intrinsic-ink/90">
                  {h.symbol ? (
                    <span className="mr-1.5 font-semibold text-intrinsic-ink">
                      {h.symbol}
                    </span>
                  ) : null}
                  {h.name}
                </span>
                {h.weight !== null ? (
                  <span className="shrink-0 tabular-nums text-intrinsic-secondary">
                    {formatPercentFromDecimal(h.weight, 1)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Shared profile content for the info popover and the stock page "About" card. */
export function CompanyProfileBody({ profile, size = "compact" }: Props) {
  const [showFull, setShowFull] = useState(false);
  const descId = useId();
  const comfortable = size === "comfortable";

  // Prefer the AI one-liner; otherwise lead with Yahoo's own description.
  const lead = profile.plainEnglish ?? profile.summary;
  const leadIsSummary = profile.plainEnglish === null && profile.summary !== null;
  const canExpand = profile.plainEnglish !== null && profile.summary !== null;

  return (
    <div className="space-y-4">
      {lead ? (
        <p
          className={`text-intrinsic-ink ${
            comfortable ? "text-base leading-relaxed sm:text-lg" : "text-[15px] leading-relaxed"
          } ${leadIsSummary && !showFull ? "line-clamp-5" : ""}`}
        >
          {lead}
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-intrinsic-secondary">
          {isFund(profile)
            ? "Yahoo Finance doesn't publish a description for this fund. Here's what's inside it."
            : "Yahoo Finance doesn't publish a business description for this company."}
        </p>
      )}

      <Chips profile={profile} />

      {canExpand || (leadIsSummary && (profile.summary?.length ?? 0) > 320) ? (
        <div>
          <button
            type="button"
            onClick={() => setShowFull((v) => !v)}
            aria-expanded={showFull}
            aria-controls={canExpand ? descId : undefined}
            className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-intrinsic-secondary transition-colors hover:text-intrinsic-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-intrinsic-secondary"
          >
            {showFull
              ? canExpand
                ? "Hide full description"
                : "Show less"
              : canExpand
                ? "Read full description"
                : "Show more"}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${showFull ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {canExpand && showFull ? (
            <p
              id={descId}
              className="mt-2 text-[13px] leading-relaxed text-intrinsic-ink/75"
            >
              {profile.summary}
            </p>
          ) : null}
        </div>
      ) : null}

      <FundFacts profile={profile} />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
        {profile.website ? (
          <a
            href={profile.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-intrinsic-ink/80 underline-offset-2 hover:text-intrinsic-ink hover:underline"
          >
            {websiteLabel(profile.website)}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : (
          <span />
        )}
        <p className="text-[10px] leading-snug text-intrinsic-secondary/80">
          {profile.plainEnglish
            ? "Summary written by AI from the Yahoo Finance description."
            : "Source: Yahoo Finance."}
        </p>
      </div>
    </div>
  );
}

export function CompanyProfileSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-3.5 w-full animate-pulse rounded bg-intrinsic-secondary/15" />
      <div className="h-3.5 w-11/12 animate-pulse rounded bg-intrinsic-secondary/15" />
      <div className="h-3.5 w-3/5 animate-pulse rounded bg-intrinsic-secondary/15" />
      <div className="flex gap-1.5 pt-1">
        <div className="h-5 w-20 animate-pulse rounded-full bg-intrinsic-accent" />
        <div className="h-5 w-28 animate-pulse rounded-full bg-intrinsic-accent" />
      </div>
    </div>
  );
}

export function StockPageLink({ symbol }: { symbol: string }) {
  return (
    <Link
      href={`/stock/${encodeURIComponent(symbol)}`}
      className="inline-flex items-center gap-1 text-xs font-semibold text-intrinsic-ink underline-offset-2 hover:underline"
    >
      Open {symbol} page →
    </Link>
  );
}
