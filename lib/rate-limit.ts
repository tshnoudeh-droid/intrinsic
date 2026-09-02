import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit =
  UPSTASH_URL && UPSTASH_TOKEN
    ? new Ratelimit({
        redis: new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN }),
        // 20 chat messages per hour per IP — generous for a real conversation,
        // tight enough to protect the free Groq key from scripted abuse.
        limiter: Ratelimit.slidingWindow(20, "1 h"),
        prefix: "intrinsic:chat",
      })
    : null;

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

/**
 * Falls open (allows the request) if Upstash env vars aren't configured, so
 * local dev works without setting up a Redis instance. Configure
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN before shipping to prod.
 */
export async function checkChatRateLimit(
  identifier: string,
): Promise<RateLimitResult> {
  if (!ratelimit) {
    return { success: true, remaining: 20, reset: 0 };
  }
  const { success, remaining, reset } = await ratelimit.limit(identifier);
  return { success, remaining, reset };
}

export function clientIdentifierFromRequest(request: Request): string {
  const headers = request.headers;
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
}
