# Insights — e2e

Non-obvious lessons from working in this package, captured by the `engineering-insights` skill.
Read before a non-trivial change and treat as high-confidence guidance unless told otherwise.
Append-only: add a bullet at the end of a section, never rewrite old ones — a newer entry marks
itself `(supersedes YYYY-MM-DD entry)`. Humans prune periodically.

Entry: `- **YYYY-MM-DD** · <what is true> → <what to do> · \`path/to/file.ts:42\``

## What Works

## What Doesn't Work

## Codebase Patterns

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes
- **2026-09-16** · Run cost feature: extended flows 02 and 04 with cost text waits; added 1 Open Question.

## Open Questions
- **2026-09-16** · Cost assertions `$0.014` (flow 02) and `9,500 tok · $0.014` (flow 04) were added but never executed — `agent-browser` is not installed locally → run `npm i -g agent-browser && ./scripts/e2e.sh` and confirm both steps pass · `e2e/specs/04-pr-findings.flow.json`
