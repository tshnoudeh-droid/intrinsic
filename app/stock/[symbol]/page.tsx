import { StockPageContent } from "@/components/StockPageContent";

type Props = {
  params: Promise<{ symbol: string }>;
};

export default async function StockPage({ params }: Props) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw);

  return <StockPageContent key={symbol} symbol={symbol} />;
}
