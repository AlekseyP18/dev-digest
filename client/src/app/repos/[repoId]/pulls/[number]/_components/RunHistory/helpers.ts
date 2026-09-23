import type { PrCommit, RunSummary } from "@devdigest/shared";
import { toEpoch } from "@/lib/format-date";

export type TimelineItem =
  | { kind: "run"; ts: number; run: RunSummary }
  | { kind: "commit"; ts: number; commit: PrCommit };

/** Runs and commits interleaved, newest first; undated items sort last. */
export function buildTimeline(runs: RunSummary[], commits: PrCommit[]): TimelineItem[] {
  return [
    ...runs.map((run) => ({ kind: "run" as const, ts: toEpoch(run.ran_at), run })),
    ...commits.map((commit) => ({ kind: "commit" as const, ts: toEpoch(commit.committed_at), commit })),
  ].sort((a, b) => b.ts - a.ts);
}

/** Total tokens of a run, or null when neither side was recorded. */
export function runTokens(run: Pick<RunSummary, "tokens_in" | "tokens_out">): number | null {
  if (run.tokens_in == null && run.tokens_out == null) return null;
  return (run.tokens_in ?? 0) + (run.tokens_out ?? 0);
}
