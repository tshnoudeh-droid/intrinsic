import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Screener | Intrinsic",
  description:
    "Describe what you want in plain English and screen the S&P 500, the TSX 60 and popular ETFs.",
};

export default function ScreenerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
