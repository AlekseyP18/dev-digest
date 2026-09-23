import type { PrStatus } from "@devdigest/shared";

/** A merged/closed PR can still be reviewed, but only informationally. */
export function isFinished(status: PrStatus): boolean {
  return status === "merged" || status === "closed";
}

/** Status dot colour in the header badge. */
export function statusColor(status: PrStatus): string {
  if (status === "merged") return "var(--ok)";
  if (status === "closed") return "var(--stale)";
  return "var(--warn)";
}
