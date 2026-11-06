import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found | Intrinsic",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-medium text-intrinsic-secondary">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-intrinsic-ink">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 text-pretty text-[15px] leading-relaxed text-intrinsic-ink-soft">
        The link may be broken or the page may have moved. Try one of the tools
        instead.
      </p>
      <div className="mt-8 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
        <Link
          href="/explore"
          className="rounded-full bg-intrinsic-ink px-6 py-2.5 text-sm font-medium text-intrinsic-light transition-opacity hover:opacity-90"
        >
          Value a stock
        </Link>
        <Link
          href="/screener"
          className="rounded-full border border-intrinsic-secondary/30 px-6 py-2.5 text-sm font-medium text-intrinsic-ink transition-colors hover:bg-intrinsic-secondary/10"
        >
          Open the Screener
        </Link>
      </div>
      <Link
        href="/"
        className="mt-6 text-sm text-intrinsic-ink-soft underline-offset-4 hover:underline"
      >
        Back to home
      </Link>
    </div>
  );
}
