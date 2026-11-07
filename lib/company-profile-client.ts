"use client";

import { useCallback, useEffect, useState } from "react";
import type { CompanyProfile } from "@/lib/company-profile";

export type { CompanyProfile, CompanyProfileFund } from "@/lib/company-profile";

/** Shared across every CompanyInfoButton / About section on the page. */
const profileCache = new Map<string, Promise<CompanyProfile>>();

function isCompanyProfile(json: unknown): json is CompanyProfile {
  if (!json || typeof json !== "object") return false;
  const o = json as Record<string, unknown>;
  return (
    o.error !== true &&
    typeof o.symbol === "string" &&
    typeof o.name === "string"
  );
}

export class CompanyProfileNotFound extends Error {}

export function fetchCompanyProfile(symbol: string): Promise<CompanyProfile> {
  const key = symbol.trim().toUpperCase();
  const cached = profileCache.get(key);
  if (cached) return cached;

  const request = fetch(
    `/api/company-profile?symbol=${encodeURIComponent(key)}`,
  ).then(async (res) => {
    const json: unknown = await res.json().catch(() => null);
    if (res.status === 404) throw new CompanyProfileNotFound(key);
    if (!res.ok || !isCompanyProfile(json)) {
      throw new Error("Failed to load company profile");
    }
    return json;
  });

  profileCache.set(key, request);
  // Drop failures so a later open can retry (404s stay cached).
  request.catch((error: unknown) => {
    if (!(error instanceof CompanyProfileNotFound)) profileCache.delete(key);
  });
  return request;
}

export type CompanyProfileState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; notFound: boolean }
  | { status: "ready"; profile: CompanyProfile };

/**
 * Loads a profile once `enabled` becomes true (lazy for popovers, eager for
 * the stock page). `retry` re-issues the request after an error.
 */
export function useCompanyProfile(
  symbol: string,
  enabled: boolean,
): { state: CompanyProfileState; retry: () => void } {
  const [state, setState] = useState<CompanyProfileState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !symbol) return;
    let cancelled = false;
    // Loading state is set inside the async chain to satisfy the
    // "no synchronous setState in effects" lint rule.
    Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setState((s) => (s.status === "ready" ? s : { status: "loading" }));
        }
        return fetchCompanyProfile(symbol);
      })
      .then((profile) => {
        if (!cancelled) setState({ status: "ready", profile });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            notFound: error instanceof CompanyProfileNotFound,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, enabled, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { state, retry };
}

export function formatCompactMoney(
  value: number | null,
  currency: string | null,
): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return null;
  }
}

export function formatPercentFromDecimal(
  value: number | null,
  digits = 2,
): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return `${(value * 100).toFixed(digits)}%`;
}
