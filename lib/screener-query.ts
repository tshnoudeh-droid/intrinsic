import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScreenerFilter, ScreenerStockRow } from "@/lib/screener-types";

export async function runScreenerQuery(
  supabase: SupabaseClient,
  filters: ScreenerFilter[],
): Promise<{ rows: ScreenerStockRow[] } | { error: string }> {
  let query = supabase.from("screener_stocks").select("*");

  for (const filter of filters) {
    switch (filter.operator) {
      case "gt":
        query = query.gt(filter.field, filter.value);
        break;
      case "gte":
        query = query.gte(filter.field, filter.value);
        break;
      case "lt":
        query = query.lt(filter.field, filter.value);
        break;
      case "lte":
        query = query.lte(filter.field, filter.value);
        break;
      case "eq":
        query = query.eq(filter.field, filter.value);
        break;
    }
  }

  const { data, error } = await query.order("margin_of_safety", {
    ascending: false,
    nullsFirst: false,
  });

  if (error) {
    return { error: error.message };
  }
  return { rows: (data ?? []) as ScreenerStockRow[] };
}
