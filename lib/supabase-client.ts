import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Server-only client using the service-role key — bypasses row-level
 * security. Never import this from a "use client" component. Returns null
 * when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren't configured, so
 * callers can degrade gracefully instead of crashing.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return cached;
}
