import { NextRequest, NextResponse } from "next/server";
import {
  getCompanyProfile,
  ProfileNotFoundError,
} from "@/lib/company-profile";
import { CACHE_HEADERS_NO_STORE } from "@/lib/http-cache-headers";
import {
  checkCompanyProfileRateLimit,
  clientIdentifierFromRequest,
} from "@/lib/rate-limit";
import { isValidTickerSymbol } from "@/lib/stock-validation";
import { normalizeSymbol } from "@/lib/symbol-normalize";

export const maxDuration = 30;

// Profiles rarely change: let the CDN hold them for a day.
const CACHE_LONG = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
} as const;
// Summary exists but the AI line is missing (Groq failure / rate limit):
// cache briefly so the next visitor can get the generated version.
const CACHE_SHORT = {
  "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
} as const;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  const symbol = raw ? normalizeSymbol(raw) : "";
  if (!symbol || !isValidTickerSymbol(symbol)) {
    return NextResponse.json(
      { error: true, message: "A valid ticker symbol is required" },
      { status: 400, headers: CACHE_HEADERS_NO_STORE },
    );
  }

  const rateLimit = await checkCompanyProfileRateLimit(
    clientIdentifierFromRequest(request),
  );

  try {
    const profile = await getCompanyProfile(symbol, {
      allowGenerate: rateLimit.success,
    });
    const complete = profile.summary === null || profile.plainEnglish !== null;
    return NextResponse.json(profile, {
      headers: complete ? CACHE_LONG : CACHE_SHORT,
    });
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json(
        { error: true, message: "No profile found for that symbol" },
        { status: 404, headers: CACHE_SHORT },
      );
    }
    console.error(`[company-profile] failed for ${symbol}`, error);
    return NextResponse.json(
      { error: true, message: "Failed to load company profile" },
      { status: 502, headers: CACHE_HEADERS_NO_STORE },
    );
  }
}
