import Link from "next/link";

export default function WatchlistPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16 text-center sm:py-20">
      <p className="text-pretty text-base leading-relaxed text-intrinsic-secondary sm:text-lg">
        Your watchlist lives in the sidebar. Click the bookmark icon in the
        navbar to open it.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-full border border-intrinsic-secondary/25 bg-intrinsic-light px-6 py-2.5 text-sm font-medium text-intrinsic-ink transition-colors hover:bg-intrinsic-secondary/10"
      >
        Back to home
      </Link>
    </div>
  );
}
