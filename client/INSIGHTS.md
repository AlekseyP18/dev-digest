# Insights — client

Non-obvious lessons from working in this package, captured by the `engineering-insights` skill.
Read before a non-trivial change and treat as high-confidence guidance unless told otherwise.
Append-only: add a bullet at the end of a section, never rewrite old ones — a newer entry marks
itself `(supersedes YYYY-MM-DD entry)`. Humans prune periodically.

Entry: `- **YYYY-MM-DD** · <what is true> → <what to do> · \`path/to/file.ts:42\``

## What Works

## What Doesn't Work

## Codebase Patterns
- **2026-09-16** · Unknown run cost must render "—", never "$0.00" (0 reads as free) → use `formatCost` / `RunCostBadge`, which map null/undefined to a dash · `client/src/lib/format-cost.ts:8`

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes
- **2026-09-16** · Run cost badge on PR list, timeline and trace drawer (spec `specs/001-run-cost-badge.md`); added 1 entry above.

## Open Questions
