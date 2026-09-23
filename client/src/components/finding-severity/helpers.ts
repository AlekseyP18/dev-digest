import type { ReviewRecord, Severity } from "@devdigest/shared";

/** Severity → CSS colour token. Order, counts and blockers live in `@/lib/severity`. */
export const SEV_COLOR: Record<Severity, string> = {
  CRITICAL: "var(--crit)",
  WARNING: "var(--warn)",
  SUGGESTION: "var(--sugg)",
};

/** Fallback colour for an unknown severity. */
export const SEV_COLOR_FALLBACK = "var(--text-muted)";

/**
 * Newest `kind: "review"` record of EACH agent — what the PR list's FINDINGS
 * column sums (one Run Review writes one review per agent). Matches the
 * server's `latestReviewIdsPerAgent`; agent-less reviews share one bucket.
 */
export function latestReviewsPerAgent(reviews: ReviewRecord[] | undefined): ReviewRecord[] {
  const newest = new Map<string, ReviewRecord>();
  for (const r of reviews ?? []) {
    if (r.kind !== "review") continue;
    const key = r.agent_id ?? "none";
    const cur = newest.get(key);
    if (!cur || Date.parse(r.created_at) > Date.parse(cur.created_at)) newest.set(key, r);
  }
  return [...newest.values()];
}
