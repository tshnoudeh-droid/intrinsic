import type { Metadata } from "next";
import { headers } from "next/headers";
import { StockPageContent } from "@/components/StockPageContent";
import { normalizeSymbol } from "@/lib/symbol-normalize";

type Props = {
  params: Promise<{ symbol: string }>;
};

async function appBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol: raw } = await params;
  const symbol = normalizeSymbol(decodeURIComponent(raw));
  const base = await appBaseUrl();
  try {
    const res = await fetch(
      `${base}/api/stock?symbol=${encodeURIComponent(symbol)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      return { title: `${symbol} | Intrinsic` };
    }
    const json: unknown = await res.json();
    if (
      !json ||
      typeof json !== "object" ||
      (json as { error?: unknown }).error === true
    ) {
      return { title: `${symbol} | Intrinsic` };
    }
    const o = json as { symbol?: string; name?: string };
    if (typeof o.name !== "string" || !o.name) {
      return { title: `${symbol} | Intrinsic` };
    }
    const sym = typeof o.symbol === "string" ? o.symbol : symbol;
    return { title: `${sym} — ${o.name} | Intrinsic` };
  } catch {
    return { title: `${symbol} | Intrinsic` };
  }
}

export default async function StockPage({ params }: Props) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw);

  return <StockPageContent key={symbol} symbol={symbol} />;
}
