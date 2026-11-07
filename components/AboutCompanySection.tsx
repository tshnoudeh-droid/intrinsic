"use client";

import {
  CompanyProfileBody,
  CompanyProfileSkeleton,
} from "@/components/CompanyProfileBody";
import { useCompanyProfile } from "@/lib/company-profile-client";
import { STOCK_PAGE_COPY } from "@/lib/stock-page-copy";

type Props = {
  symbol: string;
  isFund: boolean;
};

/** "About the company / fund" card near the top of the stock page. */
export function AboutCompanySection({ symbol, isFund }: Props) {
  const { state, retry } = useCompanyProfile(symbol, true);
  const title = isFund
    ? STOCK_PAGE_COPY.aboutFundTitle
    : STOCK_PAGE_COPY.aboutCompanyTitle;

  // A missing profile shouldn't leave an empty card on the page.
  if (state.status === "error" && state.notFound) return null;

  return (
    <section
      className="rounded-2xl border border-intrinsic-secondary/10 bg-intrinsic-light px-5 py-6 text-left shadow-sm sm:rounded-3xl sm:px-8 sm:py-7"
      aria-label={title}
    >
      <p className="mb-4 text-xs font-medium uppercase tracking-widest text-intrinsic-secondary">
        {title}
      </p>
      {state.status === "ready" ? (
        <CompanyProfileBody profile={state.profile} size="comfortable" />
      ) : state.status === "error" ? (
        <p className="text-sm text-intrinsic-secondary">
          {STOCK_PAGE_COPY.aboutLoadError}{" "}
          <button
            type="button"
            onClick={retry}
            className="font-medium text-intrinsic-ink underline-offset-2 hover:underline"
          >
            Try again
          </button>
        </p>
      ) : (
        <CompanyProfileSkeleton />
      )}
    </section>
  );
}
