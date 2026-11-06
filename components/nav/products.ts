import { Gauge, ListFilter, type LucideIcon } from "lucide-react";

export type Product = {
  id: "valuator" | "screener";
  /** Short label for navigation */
  label: string;
  /** Full product name */
  name: string;
  href: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

export const PRODUCTS: readonly Product[] = [
  {
    id: "valuator",
    label: "Valuator",
    name: "Intrinsic Valuator",
    href: "/explore",
    icon: Gauge,
    isActive: (p) => p === "/explore" || p.startsWith("/stock/"),
  },
  {
    id: "screener",
    label: "Screener",
    name: "Intrinsic Screener",
    href: "/screener",
    icon: ListFilter,
    isActive: (p) => p === "/screener" || p.startsWith("/screener/"),
  },
];

/** Window event that asks the navbar to open the watchlist drawer. */
export const OPEN_WATCHLIST_EVENT = "intrinsic-open-watchlist";
