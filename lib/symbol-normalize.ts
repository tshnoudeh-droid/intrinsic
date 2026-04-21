/**
 * Normalize ticker symbols for Yahoo Finance.
 * TSX class shares (RCI.B.TO → RCI-B.TO), US class (BRK.B → BRK-B), .TO / .V preserved.
 */
export function normalizeSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();

  const tsxClassMatch = upper.match(/^([A-Z]+)\.([A-Z])\.TO$/);
  if (tsxClassMatch) {
    return `${tsxClassMatch[1]}-${tsxClassMatch[2]}.TO`;
  }

  const tsxVentureClassMatch = upper.match(/^([A-Z]+)\.([A-Z])\.V$/);
  if (tsxVentureClassMatch) {
    return `${tsxVentureClassMatch[1]}-${tsxVentureClassMatch[2]}.V`;
  }

  const usClassMatch = upper.match(/^([A-Z]+)\.([A-Z])$/);
  if (usClassMatch) {
    return `${usClassMatch[1]}-${usClassMatch[2]}`;
  }

  if (upper.endsWith(".TO") || upper.endsWith(".V")) {
    return upper;
  }

  return upper;
}
