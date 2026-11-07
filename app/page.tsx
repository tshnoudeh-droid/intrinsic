import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Database, Gauge, ListFilter, Lock, SlidersHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AccountCta } from "@/components/home/AccountCta";
import { ScreenerPreview, ValuatorPreview } from "@/components/home/ProductPreviews";

export const metadata: Metadata = {
  title: "Intrinsic: what is a stock actually worth?",
  description:
    "Two free tools for US and Canadian stocks. The Intrinsic Valuator estimates what a stock is worth with a simple DCF model; the Intrinsic Screener finds stocks from a plain-English description.",
};

type ProductCard = {
  name: string;
  icon: LucideIcon;
  headline: string;
  body: string;
  steps: string[];
  cta: string;
  href: string;
  preview: React.ReactNode;
};

const PRODUCT_CARDS: ProductCard[] = [
  {
    name: "Intrinsic Valuator",
    icon: Gauge,
    headline: "Find what a stock is actually worth.",
    body: "Enter a ticker or company name. The Valuator pulls real financials, runs a five-year discounted cash flow model, and puts the intrinsic value right next to today's price.",
    steps: [
      "Undervalued, fair, or overvalued, with the margin of safety",
      "Price chart with the intrinsic value as a reference line",
      "Adjust growth and discount rate to match your view",
    ],
    cta: "Value a stock",
    href: "/explore",
    preview: <ValuatorPreview />,
  },
  {
    name: "Intrinsic Screener",
    icon: ListFilter,
    headline: "Describe what you want. Get a list.",
    body: "Type what you're looking for in plain English, like “undervalued and P/E below 20.” The Screener turns it into filters and returns matching stocks from the S&P 500 and TSX 60.",
    steps: [
      "No filter menus: just write it the way you'd say it",
      "See exactly which filters were applied",
      "Open any result in the Valuator for the full picture",
    ],
    cta: "Try the Screener",
    href: "/screener",
    preview: <ScreenerPreview />,
  },
];

const PRINCIPLES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Database,
    title: "Real financial data",
    body: "Prices, cash flows, and fundamentals from Yahoo Finance for NYSE, NASDAQ, and TSX companies.",
  },
  {
    icon: SlidersHorizontal,
    title: "A transparent model",
    body: "A simplified DCF with every assumption shown, so you can see and change what drives the number.",
  },
  {
    icon: Lock,
    title: "No account needed",
    body: "Both tools are free to use signed out. Sign in only if you want to keep a watchlist.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col pb-20 sm:pb-24">
      {/* Hero */}
      <section className="flex flex-col items-center pt-16 text-center sm:pt-24 lg:pt-28">
        <p className="inline-flex items-center gap-2 rounded-full border border-intrinsic-secondary/20 bg-intrinsic-light/70 px-3 py-1 text-xs font-medium text-intrinsic-ink-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          Free for US &amp; Canadian stocks
        </p>
        <h1 className="mt-6 max-w-3xl text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-intrinsic-ink sm:text-6xl lg:text-7xl">
          Know what a stock is really worth.
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-intrinsic-ink-soft sm:text-lg">
          Intrinsic gives you two simple tools for thinking independently: the{" "}
          <span className="font-medium text-intrinsic-ink">Valuator</span>{" "}
          estimates any company&apos;s fair value, and the{" "}
          <span className="font-medium text-intrinsic-ink">Screener</span>{" "}
          finds stocks from a plain-English description.
        </p>
        <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
          <Link
            href="/explore"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-intrinsic-ink px-6 py-3 text-sm font-medium text-intrinsic-light shadow-sm transition-opacity hover:opacity-90"
          >
            <Gauge className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Value a stock
          </Link>
          <Link
            href="/screener"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-intrinsic-secondary/30 bg-intrinsic-light/60 px-6 py-3 text-sm font-medium text-intrinsic-ink transition-colors hover:bg-intrinsic-light"
          >
            <ListFilter className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Open the Screener
          </Link>
        </div>
        <p className="mt-4 text-xs text-intrinsic-secondary">
          No sign-up required.
        </p>
      </section>

      {/* Products */}
      <section aria-labelledby="products-heading" className="mt-20 sm:mt-28">
        <h2 id="products-heading" className="sr-only">
          The two Intrinsic tools
        </h2>
        <div className="grid gap-5 md:grid-cols-2 md:gap-6">
          {PRODUCT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.name}
                className="group flex flex-col rounded-3xl border border-intrinsic-secondary/15 bg-intrinsic-light p-6 shadow-sm shadow-black/[0.03] transition-shadow duration-300 hover:shadow-lg hover:shadow-black/[0.06] sm:p-8"
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-intrinsic-ink text-intrinsic-light">
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <p className="text-sm font-semibold text-intrinsic-ink">
                    {card.name}
                  </p>
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-intrinsic-ink sm:text-[1.7rem]">
                  {card.headline}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-intrinsic-ink-soft">
                  {card.body}
                </p>
                <div className="mt-6">{card.preview}</div>
                <ul className="mt-6 space-y-2.5">
                  {card.steps.map((step) => (
                    <li
                      key={step}
                      className="flex gap-2.5 text-sm leading-snug text-intrinsic-ink-soft"
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-intrinsic-secondary"
                        aria-hidden
                      />
                      {step}
                    </li>
                  ))}
                </ul>
                <Link
                  href={card.href}
                  className="mt-8 inline-flex items-center justify-center gap-2 self-start rounded-full bg-intrinsic-ink px-5 py-2.5 text-sm font-medium text-intrinsic-light transition-opacity hover:opacity-90"
                >
                  {card.cta}
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      {/* Principles */}
      <section aria-labelledby="principles-heading" className="mt-20 sm:mt-28">
        <h2
          id="principles-heading"
          className="text-center text-2xl font-semibold tracking-tight text-intrinsic-ink sm:text-3xl"
        >
          Built for clarity, not hype
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="text-center sm:text-left">
              <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-intrinsic-light text-intrinsic-ink ring-1 ring-intrinsic-secondary/15 sm:mx-0">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold text-intrinsic-ink">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-intrinsic-ink-soft">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-20 sm:mt-28">
        <AccountCta />
      </div>
    </div>
  );
}
