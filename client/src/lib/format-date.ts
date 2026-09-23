/* format-date.ts — timestamp parsing/formatting shared across screens. */

/** Epoch ms for sorting; missing or unparseable timestamps become 0 (sort last). */
export function toEpoch(iso: string | null | undefined): number {
  if (!iso) return 0;
  const n = Date.parse(iso);
  return Number.isNaN(n) ? 0 : n;
}

/** Locale date + time; an unparseable value is shown as-is. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** Locale time of day; an unparseable value is shown as-is. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString();
}
