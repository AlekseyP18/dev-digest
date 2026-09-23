import type { FindingRecord, ReviewRecord } from "@devdigest/shared";

/** Lethal-trifecta findings across all review runs of the PR. */
export function lethalTrifectaFindings(reviews: ReviewRecord[]): FindingRecord[] {
  return reviews.flatMap((r) => r.findings).filter((f) => f.kind === "lethal_trifecta");
}

/** Reviews indexed by the run that produced them (runs without a review are absent). */
export function reviewsByRunId(reviews: ReviewRecord[]): Map<string, ReviewRecord> {
  const m = new Map<string, ReviewRecord>();
  for (const r of reviews) if (r.run_id) m.set(r.run_id, r);
  return m;
}

/**
 * Which accordion gets the j/k/a/d keys: the one the user last opened or
 * navigated to while it is still open, else the topmost open one.
 */
export function activeReviewId(
  reviews: ReviewRecord[],
  isOpen: (reviewId: string) => boolean,
  lastTouchedId: string | null,
): string | null {
  if (lastTouchedId && isOpen(lastTouchedId) && reviews.some((r) => r.id === lastTouchedId)) {
    return lastTouchedId;
  }
  return reviews.find((r) => isOpen(r.id))?.id ?? null;
}

/**
 * Default open state for reviews not seen before: open iff newest (index 0) at
 * the moment they first appear. Already-seen reviews keep their recorded default.
 */
export function seenDefaults(reviews: ReviewRecord[], seen: Record<string, boolean>): Record<string, boolean> {
  const next = { ...seen };
  reviews.forEach((r, i) => {
    if (!(r.id in next)) next[r.id] = i === 0;
  });
  return next;
}
