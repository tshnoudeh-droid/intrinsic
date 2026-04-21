"use client";

import { Show, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function HomeWithRedirect() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoaded) return;
    if (searchParams.get("home") === "1") return;
    if (isSignedIn) {
      router.replace("/explore");
    }
  }, [isLoaded, isSignedIn, router, searchParams]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <section className="flex flex-col items-center pb-16 text-center sm:pb-20 lg:pb-24">
        <div className="flex w-full flex-col items-center pt-24 sm:pt-28 lg:pt-32">
          <h1 className="text-balance text-5xl font-bold leading-tight tracking-tight text-intrinsic-ink sm:text-6xl lg:text-7xl">
            Find the true value of any stock.
          </h1>
          <p className="mt-6 max-w-[560px] text-pretty text-lg leading-relaxed text-intrinsic-secondary sm:mt-8">
            Intrinsic uses real financial data and a simplified DCF model to help
            you understand whether a stock is overvalued or undervalued — before
            you buy or sell.
          </p>
          {isLoaded && isSignedIn ? (
            <Link
              href="/explore"
              className="mt-8 inline-flex rounded-full bg-[#A69486] px-6 py-2 text-sm font-medium text-white transition-opacity hover:opacity-95"
            >
              Go to app →
            </Link>
          ) : null}
        </div>

        <div className="mt-16 w-full sm:mt-20 lg:mt-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-intrinsic-ink sm:text-3xl">
            What is Intrinsic?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-center text-base leading-relaxed text-intrinsic-secondary sm:mt-8 sm:text-lg">
            Intrinsic is built for investors who want to think independently.
            Instead of following hype or market noise, it uses cash flow data to
            estimate what a company is actually worth — then shows you how far
            the current price is from that number.
          </p>
        </div>

        <div className="mt-16 w-full sm:mt-20 lg:mt-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-intrinsic-ink sm:text-3xl">
            How it works
          </h2>
          <div className="mt-12 grid gap-12 sm:mt-14 md:grid-cols-3 md:gap-8 lg:gap-10">
            <div className="text-center md:text-left">
              <p className="text-sm font-semibold uppercase tracking-wider text-intrinsic-secondary">
                Step 1
              </p>
              <h3 className="mt-2 text-lg font-semibold text-intrinsic-ink sm:text-xl">
                Search any stock
              </h3>
              <p className="mt-3 text-base leading-relaxed text-intrinsic-secondary">
                Find any stock on the TSX, NYSE, or NASDAQ by ticker or company
                name.
              </p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-sm font-semibold uppercase tracking-wider text-intrinsic-secondary">
                Step 2
              </p>
              <h3 className="mt-2 text-lg font-semibold text-intrinsic-ink sm:text-xl">
                We run the numbers
              </h3>
              <p className="mt-3 text-base leading-relaxed text-intrinsic-secondary">
                We pull real financial data and run a Discounted Cash Flow model
                to estimate intrinsic value.
              </p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-sm font-semibold uppercase tracking-wider text-intrinsic-secondary">
                Step 3
              </p>
              <h3 className="mt-2 text-lg font-semibold text-intrinsic-ink sm:text-xl">
                You make the call
              </h3>
              <p className="mt-3 text-base leading-relaxed text-intrinsic-secondary">
                See if the stock is overvalued or undervalued, then adjust the
                assumptions to match your own view.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div
        className="my-16 h-px w-full bg-[#A69486]/30"
        aria-hidden="true"
      />

      <section className="mx-auto flex w-full max-w-[480px] flex-col pb-8">
        <Show when="signed-out">
          <h2 className="text-center text-2xl font-semibold text-intrinsic-ink">
            Start investing with clarity.
          </h2>
          <p className="mt-3 text-center text-sm text-[#A69486]">
            Create a free account to unlock your watchlist, save stocks, and
            track valuations over time.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/sign-up"
              className="w-full rounded-full bg-[#A69486] py-3 text-center text-sm font-medium text-white transition-opacity hover:opacity-95"
            >
              Create a free account
            </Link>
            <Link
              href="/sign-in"
              className="w-full rounded-full border border-[#A69486] bg-transparent py-3 text-center text-sm font-medium text-[#A69486] transition-colors hover:bg-[#A69486]/5"
            >
              Sign in
            </Link>
            <Link
              href="/explore"
              className="text-center text-sm text-[#A69486] underline-offset-4 hover:underline"
            >
              Continue as guest →
            </Link>
          </div>
        </Show>

        <Show when="signed-in">
          <div className="flex justify-center">
            <Link
              href="/explore"
              className="inline-flex rounded-full bg-[#A69486] px-6 py-2 text-sm font-medium text-white transition-opacity hover:opacity-95"
            >
              Continue to Intrinsic →
            </Link>
          </div>
        </Show>
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeWithRedirect />
    </Suspense>
  );
}
