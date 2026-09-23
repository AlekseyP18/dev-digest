import type { Verdict } from "@devdigest/shared";

/** Verdict → colour token for the header badge. */
export const VERDICT_COLOR: Record<Verdict, string> = {
  request_changes: "var(--crit)",
  comment: "var(--warn)",
  approve: "var(--ok)",
};

export const VERDICT_COLOR_FALLBACK = "var(--text-muted)";

/** DOM id of a run's accordion — the timeline scrolls to it. */
export const reviewRunDomId = (runId: string) => `review-run-${runId}`;
