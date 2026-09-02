import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

const NEWS_COUNT = 5;

export type StockNewsItem = {
  title: string;
  publisher: string;
  publishedAt: string | null;
};

/**
 * Yahoo's search endpoint bundles related news with quote results; there's no
 * standalone news module in yahoo-finance2, so we reuse search() and discard
 * the quote matches.
 */
export async function fetchStockNews(symbol: string): Promise<StockNewsItem[]> {
  try {
    const result = await yahooFinance.search(symbol, {
      newsCount: NEWS_COUNT,
      quotesCount: 0,
    });
    if (!Array.isArray(result.news)) return [];
    return result.news.slice(0, NEWS_COUNT).map((item) => ({
      title: item.title,
      publisher: item.publisher,
      publishedAt:
        item.providerPublishTime instanceof Date
          ? item.providerPublishTime.toISOString()
          : null,
    }));
  } catch {
    return [];
  }
}
