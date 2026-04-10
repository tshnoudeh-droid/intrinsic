/** Prevent stale market prices/charts from CDN or browser HTTP caches. */
export const CACHE_HEADERS_NO_STORE = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
} as const;
