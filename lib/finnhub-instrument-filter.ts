/**
 * Finnhub symbol search returns a `type` per result (e.g. "Common Stock").
 * Exclude non-equity instruments when possible.
 */
export function shouldExcludeFinnhubInstrumentType(
  type: string | undefined,
): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  if (t.includes("crypto")) return true;
  if (t.includes("forex")) return true;
  if (t.includes("physical currency")) return true;
  if (t === "fx") return true;
  if (t.includes("binary option")) return true;
  return false;
}
