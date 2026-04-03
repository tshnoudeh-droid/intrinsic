import { LandingCta } from "@/components/LandingCta";
import { SearchBar } from "@/components/SearchBar";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <section className="flex flex-col items-center gap-8 py-16 text-center sm:gap-10 sm:py-20 lg:py-24">
        <div className="max-w-3xl space-y-6 sm:space-y-8">
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-intrinsic-ink sm:text-5xl lg:text-6xl">
            Find the true value of any stock
          </h1>
          <p className="text-pretty text-lg leading-relaxed text-intrinsic-secondary sm:text-xl lg:text-2xl lg:leading-relaxed">
            Intrinsic helps you understand whether a stock is overvalued or
            undervalued using real financial data and a simple valuation model.
          </p>
        </div>
        <div
          id="landing-search"
          className="w-full max-w-xl scroll-mt-24 pt-2"
        >
          <SearchBar />
        </div>
      </section>

      <div
        className="h-px w-full bg-intrinsic-secondary/15"
        aria-hidden="true"
      />

      <section className="py-16 sm:py-20 lg:py-24">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-intrinsic-ink sm:text-3xl">
          What is Intrinsic?
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-center text-base leading-relaxed text-intrinsic-secondary sm:mt-8 sm:text-lg">
          Intrinsic is a simple tool designed to help investors understand the
          real value of a stock. Instead of relying on hype or market noise, it
          uses a financial model based on cash flows to estimate what a company
          is actually worth.
        </p>
      </section>

      <div
        className="h-px w-full bg-intrinsic-secondary/15"
        aria-hidden="true"
      />

      <section className="py-16 sm:py-20 lg:py-24">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-intrinsic-ink sm:text-3xl">
          How it works
        </h2>
        <div className="mt-12 grid gap-12 sm:mt-14 md:grid-cols-3 md:gap-8 lg:gap-10">
          <div className="text-center md:text-left">
            <p className="text-sm font-semibold uppercase tracking-wider text-intrinsic-secondary">
              Step 1
            </p>
            <h3 className="mt-2 text-lg font-semibold text-intrinsic-ink sm:text-xl">
              Search a stock
            </h3>
            <p className="mt-3 text-base leading-relaxed text-intrinsic-secondary">
              Enter any stock from the TSX or U.S. markets.
            </p>
          </div>
          <div className="text-center md:text-left">
            <p className="text-sm font-semibold uppercase tracking-wider text-intrinsic-secondary">
              Step 2
            </p>
            <h3 className="mt-2 text-lg font-semibold text-intrinsic-ink sm:text-xl">
              We analyze the financials
            </h3>
            <p className="mt-3 text-base leading-relaxed text-intrinsic-secondary">
              We use real financial data to estimate future cash flows.
            </p>
          </div>
          <div className="text-center md:text-left">
            <p className="text-sm font-semibold uppercase tracking-wider text-intrinsic-secondary">
              Step 3
            </p>
            <h3 className="mt-2 text-lg font-semibold text-intrinsic-ink sm:text-xl">
              See its true value
            </h3>
            <p className="mt-3 text-base leading-relaxed text-intrinsic-secondary">
              Compare the intrinsic value to the current price instantly.
            </p>
          </div>
        </div>
      </section>

      <div
        className="h-px w-full bg-intrinsic-secondary/15"
        aria-hidden="true"
      />

      <section className="py-16 sm:py-20 lg:pb-28 lg:pt-20">
        <LandingCta />
      </section>
    </div>
  );
}
