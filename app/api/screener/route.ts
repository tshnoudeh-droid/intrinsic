import { NextResponse } from "next/server";
import { parseScreenerQuery } from "@/lib/screener-nl-parse";
import { runScreenerQuery } from "@/lib/screener-query";
import {
  checkScreenerRateLimit,
  clientIdentifierFromRequest,
} from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase-client";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 500;

type ScreenerRequestBody = { query: string };

function isScreenerRequestBody(json: unknown): json is ScreenerRequestBody {
  return (
    !!json &&
    typeof json === "object" &&
    typeof (json as Record<string, unknown>).query === "string"
  );
}

export async function POST(request: Request) {
  const identifier = clientIdentifierFromRequest(request);
  const rateLimit = await checkScreenerRateLimit(identifier);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: true,
        message: "You've hit the screener query limit for now. Try again in a bit.",
      },
      { status: 429 },
    );
  }

  const json: unknown = await request.json().catch(() => null);
  if (
    !isScreenerRequestBody(json) ||
    json.query.length === 0 ||
    json.query.length > MAX_QUERY_LENGTH
  ) {
    return NextResponse.json(
      { error: true, message: "Invalid request" },
      { status: 400 },
    );
  }

  const parsed = await parseScreenerQuery(json.query);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: true, message: parsed.reason },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: true, message: "Screener temporarily unavailable." },
      { status: 503 },
    );
  }

  const result = await runScreenerQuery(supabase, parsed.filters);
  if ("error" in result) {
    return NextResponse.json(
      { error: true, message: "Screener temporarily unavailable." },
      { status: 503 },
    );
  }

  return NextResponse.json({ filters: parsed.filters, rows: result.rows });
}
