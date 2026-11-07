import type { Metadata } from "next";
import { ValuatorLanding } from "@/components/home/ValuatorLanding";

export const metadata: Metadata = {
  title: "Valuator | Intrinsic",
  description:
    "Search any NYSE, NASDAQ, or TSX stock to see its intrinsic value next to today's price.",
};

export default function ExplorePage() {
  return <ValuatorLanding />;
}
