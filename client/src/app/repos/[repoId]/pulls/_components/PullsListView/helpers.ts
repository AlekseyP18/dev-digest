import type { PrMeta } from "@devdigest/shared";
import { toEpoch } from "@/lib/format-date";
import {
  OPEN_STATUSES,
  SIZE_MEDIUM_MAX,
  SIZE_SMALL_MAX,
  SORT_KEYS,
  type SizeInfo,
  type SortKey,
} from "./constants";

/** Bucket a PR into S/M/L by total changed lines. */
export function sizeOf(pr: PrMeta): SizeInfo {
  const lines = pr.additions + pr.deletions;
  const size = lines < SIZE_SMALL_MAX ? "S" : lines < SIZE_MEDIUM_MAX ? "M" : "L";
  return { size, lines };
}

/** Compact relative time for the list's UPDATED column (e.g. "3h", "2d"). */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const m = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** Status chip + free-text search (title or number), case-insensitive. */
export function filterPulls(pulls: PrMeta[], { status, query }: { status: string; query: string }): PrMeta[] {
  const q = query.trim().toLowerCase();
  return pulls
    .filter((p) => status === "all" || p.status === status)
    .filter((p) => !q || p.title.toLowerCase().includes(q) || String(p.number).includes(q));
}

/** New array ordered by last update; undated PRs count as oldest. */
export function sortPulls(pulls: PrMeta[], sort: SortKey): PrMeta[] {
  return [...pulls].sort((a, b) => {
    const diff = toEpoch(a.updated_at) - toEpoch(b.updated_at);
    return sort === "oldest" ? diff : -diff;
  });
}

/** Header summary: open PRs and those still needing review. */
export function pullCounts(pulls: PrMeta[]): { open: number; needsReview: number } {
  return {
    open: pulls.filter((p) => OPEN_STATUSES.has(p.status)).length,
    needsReview: pulls.filter((p) => p.status === "needs_review").length,
  };
}

/** `?sort=` value → a known sort key (default newest). */
export function toSortKey(value: string | null): SortKey {
  return (SORT_KEYS as readonly string[]).includes(value ?? "") ? (value as SortKey) : "newest";
}
