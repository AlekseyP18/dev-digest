/* severity.ts — finding-severity rules shared by the PR list, the timeline and
   the findings panel: display order, counts and what counts as a blocker. */
import type { FindingRecord, Severity, SeverityCounts } from "@devdigest/shared";

/** Severities in display order (most severe first). Mirrors the contract enum. */
export const SEVERITY_KEYS: readonly Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];

/** Position in display order; unknown severities sort last. */
export function severityRank(severity: string): number {
  const i = SEVERITY_KEYS.indexOf(severity as Severity);
  return i === -1 ? SEVERITY_KEYS.length : i;
}

/** New array, most severe first; stable for equal severities. */
export function sortBySeverity<T extends Pick<FindingRecord, "severity">>(findings: T[]): T[] {
  return [...findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

/** Group findings by severity — a plain count, never a model call. */
export function countBySeverity(findings: Pick<FindingRecord, "severity">[]): SeverityCounts {
  const counts: SeverityCounts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of findings) {
    if (f.severity in counts) counts[f.severity as Severity] += 1;
  }
  return counts;
}

export function totalFindings(counts: SeverityCounts | null | undefined): number {
  return counts ? counts.CRITICAL + counts.WARNING + counts.SUGGESTION : 0;
}

/**
 * Blockers = CRITICAL findings the user hasn't dismissed. Client-side view of a
 * loaded review; the run row's `blockers` column is the server's count at run
 * time and does not change when a finding is dismissed later.
 */
export function countBlockers(findings: Pick<FindingRecord, "severity" | "dismissed_at">[]): number {
  return findings.filter((f) => f.severity === "CRITICAL" && !f.dismissed_at).length;
}
