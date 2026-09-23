import type { ReviewRecord } from "@devdigest/shared";
import { DEFAULT_PR_TAB, PR_TABS, type PrTab } from "./constants";

/** `?tab=` value → a known tab; anything else falls back to the default tab. */
export function toPrTab(value: string | null): PrTab {
  return (PR_TABS as readonly string[]).includes(value ?? "") ? (value as PrTab) : DEFAULT_PR_TAB;
}

/** Findings across all review runs — the "Agent runs" tab counter. */
export function totalFindingsCount(reviews: ReviewRecord[] | undefined): number {
  return (reviews ?? []).reduce((n, r) => n + r.findings.length, 0);
}
