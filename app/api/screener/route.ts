import { NextResponse } from "next/server";
import { isValidFilter, parseScreenerQuery } from "@/lib/screener-nl-parse";
import { runScreenerQuery } from "@/lib/screener-query";
import {
  checkScreenerFilterRateLimit,
  checkScreenerRateLimit,
  clientIdentifierFromRequest,
} from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase-client";
import type { ScreenerFilter } from "@/lib/screener-types";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 500;
const MAX_DIRECT_FILTERS = 8;

type ParsedBody =
  | { kind: "query"; query: string }
  | { kind: "filters"; filters: ScreenerFilter[] };

/**
 * Two request shapes:
 * - `{ query }` — plain English, parsed by Groq (screener rate limit).
 * - `{ filters }` — already-structured filters from editing / removing a
 *   chip. Skips Groq entirely, so it uses a separate, roomier budget.
 */
function parseBody(json: unknown): ParsedBody | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (typeof o.query === "string") {
    if (o.query.trim().length === 0 || o.query.length > MAX_QUERY_LENGTH) {
      return null;
    }
    return { kind: "query", query: o.query };
  }
  if (Array.isArray(o.filters)) {
    if (o.filters.length > MAX_DIRECT_FILTERS) return null;
    if (!o.filters.every(isValidFilter)) return null;
    return { kind: "filters", filters: o.filters };
  }
  return null;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: true, message }, { status });
}

export async function POST(request: Request) {
  const json: unknown = await request.json().catch(() => null);
  const body = parseBody(json);
  if (!body) return errorResponse("Invalid request", 400);

  const identifier = clientIdentifierFromRequest(request);
  const rateLimit =
    body.kind === "query"
      ? await checkScreenerRateLimit(identifier)
      : await checkScreenerFilterRateLimit(identifier);
  if (!rateLimit.success) {
    return errorResponse(
      "You've hit the screener query limit for now. Try again in a bit.",
      429,
    );
  }

  let filters: ScreenerFilter[];
  if (body.kind === "query") {
    const parsed = await parseScreenerQuery(body.query);
    if (!parsed.ok) return errorResponse(parsed.reason, 400);
    filters = parsed.filters;
  } else {
    filters = body.filters;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return errorResponse("Screener temporarily unavailable.", 503);

  const result = await runScreenerQuery(supabase, filters);
  if ("error" in result) {
    return errorResponse("Screener temporarily unavailable.", 503);
  }

  return NextResponse.json({ filters, rows: result.rows });
}
