import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { unstable_cache } from "next/cache";
import YahooFinance from "yahoo-finance2";

/**
 * Company / fund profile: "what does this business do?".
 *
 * Fields come from yahoo-finance2 `quoteSummary` modules verified against live
 * responses (AAPL, BRK-B, VOO, SPY, XIU.TO, XEQT.TO):
 * - `price`: quoteType, longName/shortName, currency
 * - `assetProfile`: sector, industry, website, longBusinessSummary
 *   (ETFs only carry longBusinessSummary; Canadian ETFs often have none)
 * - `fundProfile`: family, categoryName, legalType,
 *   feesExpensesInvestment.annualReportExpenseRatio
 * - `summaryDetail`: totalAssets, yield
 * - `defaultKeyStatistics`: ytdReturn
 * - `topHoldings.holdings[]`: symbol, holdingName, holdingPercent
 */

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// Same model as app/api/chat/route.ts and lib/screener-nl-parse.ts.
const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_TIMEOUT_MS = 10_000;
const MAX_SUMMARY_CHARS = 4000;
const MAX_SUMMARY_CHARS_FOR_MODEL = 2500;
const MAX_PLAIN_ENGLISH_CHARS = 420;
const MAX_TOP_HOLDINGS = 5;

const PROFILE_REVALIDATE_SECONDS = 60 * 60 * 24; // 1 day
const PLAIN_ENGLISH_REVALIDATE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type FundTopHolding = {
  symbol: string | null;
  name: string;
  /** Decimal weight, e.g. 0.07 for 7%. */
  weight: number | null;
};

export type CompanyProfileFund = {
  category: string | null;
  fundFamily: string | null;
  legalType: string | null;
  /** Decimal, e.g. 0.0003 for 0.03%. */
  expenseRatio: number | null;
  /** Fund total assets in the fund's trading currency. */
  totalAssets: number | null;
  /** Trailing distribution yield as decimal. */
  yield: number | null;
  /** Year-to-date return as decimal. */
  ytdReturn: number | null;
  topHoldings: FundTopHolding[];
};

export type CompanyProfile = {
  symbol: string;
  name: string;
  /** Yahoo quoteType, e.g. "EQUITY", "ETF", "MUTUALFUND". */
  quoteType: string | null;
  currency: string | null;
  sector: string | null;
  industry: string | null;
  website: string | null;
  /** Yahoo longBusinessSummary (or fund description). */
  summary: string | null;
  /** 1–2 sentence beginner summary generated from `summary`; null if unavailable. */
  plainEnglish: string | null;
  /** Present only for funds (ETF / mutual fund). */
  fund: CompanyProfileFund | null;
};

type YahooProfileData = Omit<CompanyProfile, "plainEnglish">;

export class ProfileNotFoundError extends Error {
  constructor(symbol: string) {
    super(`No profile found for ${symbol}`);
    this.name = "ProfileNotFoundError";
  }
}

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function httpUrl(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function isFundQuoteType(quoteType: string | null | undefined): boolean {
  return quoteType === "ETF" || quoteType === "MUTUALFUND";
}

function parseFund(
  summary: Record<string, unknown>,
): CompanyProfileFund {
  const fp = rec(summary.fundProfile);
  const fees = rec(fp?.feesExpensesInvestment);
  const sd = rec(summary.summaryDetail);
  const dks = rec(summary.defaultKeyStatistics);
  const th = rec(summary.topHoldings);

  const holdingsRaw = Array.isArray(th?.holdings) ? th.holdings : [];
  const topHoldings: FundTopHolding[] = [];
  for (const h of holdingsRaw) {
    const r = rec(h);
    const name = str(r?.holdingName);
    if (!r || !name) continue;
    topHoldings.push({
      symbol: str(r.symbol),
      name,
      weight: num(r.holdingPercent),
    });
    if (topHoldings.length >= MAX_TOP_HOLDINGS) break;
  }

  return {
    category: str(fp?.categoryName) ?? str(dks?.category),
    fundFamily: str(fp?.family) ?? str(dks?.fundFamily),
    legalType: str(fp?.legalType),
    expenseRatio:
      num(fees?.annualReportExpenseRatio) ??
      num(dks?.annualReportExpenseRatio),
    totalAssets: num(sd?.totalAssets) ?? num(dks?.totalAssets),
    yield: num(sd?.yield) ?? num(dks?.yield),
    ytdReturn: num(dks?.ytdReturn),
    topHoldings,
  };
}

async function fetchYahooProfile(symbol: string): Promise<YahooProfileData> {
  let raw: unknown;
  try {
    // validateResult: false — fund-only modules (fundProfile/topHoldings)
    // come back sparse for equities; every field below is type-guarded.
    raw = await yahooFinance.quoteSummary(
      symbol,
      {
        modules: [
          "price",
          "assetProfile",
          "fundProfile",
          "topHoldings",
          "summaryDetail",
          "defaultKeyStatistics",
        ],
      },
      { validateResult: false },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not found/i.test(message)) throw new ProfileNotFoundError(symbol);
    throw error;
  }

  const summary = rec(raw);
  const price = rec(summary?.price);
  if (!summary || !price) throw new ProfileNotFoundError(symbol);

  const quoteType = str(price.quoteType);
  const ap = rec(summary.assetProfile);
  const longSummary = str(ap?.longBusinessSummary);

  return {
    symbol,
    name: str(price.longName) ?? str(price.shortName) ?? symbol,
    quoteType,
    currency: str(price.currency),
    sector: str(ap?.sectorDisp) ?? str(ap?.sector),
    industry: str(ap?.industryDisp) ?? str(ap?.industry),
    website: httpUrl(ap?.website),
    summary: longSummary ? longSummary.slice(0, MAX_SUMMARY_CHARS) : null,
    fund: isFundQuoteType(quoteType) ? parseFund(summary) : null,
  };
}

// Errors are not cached by unstable_cache, so transient Yahoo failures retry.
const getYahooProfileCached = unstable_cache(
  fetchYahooProfile,
  ["company-profile-yahoo-v1"],
  { revalidate: PROFILE_REVALIDATE_SECONDS },
);

const PLAIN_ENGLISH_SYSTEM_PROMPT = `You explain what a company or fund does to a complete beginner investor.

Rules:
- Use ONLY facts stated in the description you are given. Never add facts, numbers, products, or claims that are not in it.
- Write 1 or 2 short sentences, at most 45 words total.
- Plain everyday language; avoid jargon. If you must use a term, make it obvious.
- Describe what they do / what the fund holds. No opinions, no investment advice, no performance claims.
- Start directly (e.g. "Apple makes..." or "This fund owns..."). No preamble, no markdown, no quotes.`;

function cleanModelText(text: string): string | null {
  const cleaned = text
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“']+|["”']+$/g, "")
    .trim();
  if (cleaned.length < 15) return null;
  if (cleaned.length <= MAX_PLAIN_ENGLISH_CHARS) return cleaned;
  const cut = cleaned.slice(0, MAX_PLAIN_ENGLISH_CHARS);
  const lastStop = cut.lastIndexOf(". ");
  return lastStop > 40 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`;
}

async function generatePlainEnglish(
  symbol: string,
  name: string,
  summary: string,
): Promise<string> {
  const result = await generateText({
    model: groq(GROQ_MODEL),
    system: PLAIN_ENGLISH_SYSTEM_PROMPT,
    prompt: `Name: ${name} (${symbol})\n\nDescription:\n${summary.slice(0, MAX_SUMMARY_CHARS_FOR_MODEL)}`,
    maxOutputTokens: 600,
    providerOptions: { groq: { reasoningEffort: "low" } },
    abortSignal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
  });
  const cleaned = cleanModelText(result.text);
  // Throwing keeps failures out of the persistent cache.
  if (!cleaned) throw new Error("Empty plain-English summary");
  return cleaned;
}

// Keyed by args (symbol, name, summary), so a changed Yahoo summary regenerates.
const getPlainEnglishCached = unstable_cache(
  generatePlainEnglish,
  ["company-profile-plain-english-v1"],
  { revalidate: PLAIN_ENGLISH_REVALIDATE_SECONDS },
);

/** Per-instance memo so warm lambdas skip even the cache round trip. */
const plainEnglishMemo = new Map<string, string>();
const PLAIN_ENGLISH_MEMO_MAX = 500;

function memoKey(symbol: string, summary: string): string {
  return `${symbol}:${summary.length}:${summary.slice(0, 64)}`;
}

/**
 * Returns the profile, or throws `ProfileNotFoundError` for unknown symbols.
 * `allowGenerate: false` skips the Groq call (e.g. rate-limited caller) but
 * still returns a memoized plain-English line when one exists.
 */
export async function getCompanyProfile(
  symbol: string,
  options: { allowGenerate: boolean },
): Promise<CompanyProfile> {
  const base = await getYahooProfileCached(symbol);

  let plainEnglish: string | null = null;
  if (base.summary) {
    const key = memoKey(symbol, base.summary);
    plainEnglish = plainEnglishMemo.get(key) ?? null;
    if (plainEnglish === null && options.allowGenerate) {
      try {
        plainEnglish = await getPlainEnglishCached(
          symbol,
          base.name,
          base.summary,
        );
        if (plainEnglishMemo.size >= PLAIN_ENGLISH_MEMO_MAX) {
          const oldest = plainEnglishMemo.keys().next().value;
          if (oldest !== undefined) plainEnglishMemo.delete(oldest);
        }
        plainEnglishMemo.set(key, plainEnglish);
      } catch (error) {
        console.error(`[company-profile] plain-English failed for ${symbol}`, error);
        plainEnglish = null;
      }
    }
  }

  return { ...base, plainEnglish };
}
