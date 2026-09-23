/* run-outcome.ts — what a review run's badge says. A finished run is judged by
   its deterministic blocker/finding counts (same rule as the CI gate), not by
   the model's verdict: blockers → rejected, findings → reviewed, else approved. */
import type { RunSummary } from "@devdigest/shared";

export type RunOutcome = "running" | "error" | "cancelled" | "rejected" | "reviewed" | "approved";

export function runOutcome(run: Pick<RunSummary, "status" | "blockers" | "findings_count">): RunOutcome {
  if (run.status === "running") return "running";
  if (run.status === "failed") return "error";
  if (run.status === "cancelled") return "cancelled";
  if ((run.blockers ?? 0) > 0) return "rejected";
  if ((run.findings_count ?? 0) > 0) return "reviewed";
  return "approved";
}
