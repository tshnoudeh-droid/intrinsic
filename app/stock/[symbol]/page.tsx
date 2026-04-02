import Link from "next/link";

type Props = {
  params: Promise<{ symbol: string }>;
};

/** Minimal route so search navigation resolves; full stock UI comes later. */
export default async function StockPage({ params }: Props) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-20 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-intrinsic-secondary">
        Stock
      </p>
      <h1 className="text-3xl font-semibold text-intrinsic-ink">{symbol}</h1>
      <p className="max-w-md text-intrinsic-secondary">
        Stock details will appear here in a future update.
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-intrinsic-secondary underline-offset-4 hover:underline"
      >
        Back to home
      </Link>
    </div>
  );
}
