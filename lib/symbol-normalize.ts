/**
 * Normalize ticker symbols for Yahoo Finance: dots in class tickers (e.g. BRK.B)
 * become hyphens (BRK-B). TSX `.TO` suffix is preserved.
 */
export function normalizeSymbol(symbol: string): string {
  if (symbol.includes(".")) {
    if (symbol.endsWith(".TO") || symbol.endsWith(".to")) {
      return symbol.toUpperCase();
    }
    return symbol.replace(".", "-").toUpperCase();
  }
  return symbol.toUpperCase();
}
