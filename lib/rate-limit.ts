import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  UPSTASH_URL && UPSTASH_TOKEN
    ? new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN })
    : null;

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

/**
 * Falls open only outside production (so local dev works without a Redis
 * instance). In production, missing Upstash config fails closed — otherwise
 * the free Groq key would be unprotected if the env vars were never set.
 */
function createRateLimiter(
  prefix: string,
  limit: number,
  window: `${number} ${"s" | "m" | "h" | "d"}`,
) {
  const ratelimit = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, window),
        prefix,
      })
    : null;

  return async function check(identifier: string): Promise<RateLimitResult> {
    if (!ratelimit) {
      if (process.env.NODE_ENV === "production") {
        return { success: false, remaining: 0, reset: 0 };
      }
      return { success: true, remaining: limit, reset: 0 };
    }
    const { success, remaining, reset } = await ratelimit.limit(identifier);
    return { success, remaining, reset };
  };
}

// 20 messages per hour per IP — generous for a real conversation, tight
// enough to protect the free Groq key from scripted abuse.
export const checkChatRateLimit = createRateLimiter("intrinsic:chat", 20, "1 h");

// Screener queries also call Groq for NL parsing, so use a comparable
// budget under a separate bucket — chat and screener usage shouldn't
// compete for the same quota.
export const checkScreenerRateLimit = createRateLimiter(
  "intrinsic:screener",
  20,
  "1 h",
);

/**
 * `x-vercel-forwarded-for` is set by Vercel's edge network and cannot be
 * spoofed by the client (Vercel strips any client-supplied header with that
 * name before it reaches the app). Plain `x-forwarded-for` is attacker-
 * controllable — a client can prepend a fake IP and Vercel appends the real
 * one after it — so it's only a fallback, taking the last (rightmost) entry.
 */
export function clientIdentifierFromRequest(request: Request): string {
  const headers = request.headers;
  const vercelForwardedFor = headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(",")[0].trim();
  }
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((p) => p.trim());
    return parts[parts.length - 1];
  }
  return headers.get("x-real-ip") ?? "unknown";
}
