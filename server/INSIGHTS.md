# Insights — server

Non-obvious lessons from working in this package, captured by the `engineering-insights` skill.
Read before a non-trivial change and treat as high-confidence guidance unless told otherwise.
Append-only: add a bullet at the end of a section, never rewrite old ones — a newer entry marks
itself `(supersedes YYYY-MM-DD entry)`. Humans prune periodically.

Entry: `- **YYYY-MM-DD** · <what is true> → <what to do> · \`path/to/file.ts:42\``

## What Works

## What Doesn't Work
- **2026-09-16** · `@devdigest/shared` exists as two diverged copies (server + client; `diff` shows trace.ts differs in comments) → never copy a whole contract file across; patch the same field into both copies · `client/src/vendor/shared/contracts/trace.ts`

## Codebase Patterns
- **2026-09-16** · Run cost is already computed per LLM call and summed in reviewer-core `ReviewOutcome.costUsd` (OpenRouter `usage.cost` → PriceBook → static pricing → null) but was dropped by `run-executor` → persist via `completeAgentRun({ costUsd })` + `trace.stats.cost_usd`; never add extra model calls to price a run · `server/src/modules/reviews/run-executor.ts:214`
- **2026-09-16** · `run_traces.trace` is untyped jsonb read back with a cast, so old documents lack any newly added `RunStats` field → make new trace fields `.nullish()` in the contract and treat undefined as unknown on the client · `server/src/vendor/shared/contracts/trace.ts:66`
- **2026-09-16** · `seed()` creates PR #482's review/findings/demo run ONLY inside the `if (!pr)` branch, so re-seeding an existing dev DB never adds newly seeded rows → new seed fixtures show up only on a fresh DB (`./scripts/e2e.sh` / CI); to see them locally, drop the DB and reseed · `server/src/db/seed.ts:99`

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes
- **2026-09-16** · Run cost feature (spec `specs/001-run-cost.md`): `agent_runs.cost_usd` (0010), PR list SUM of done runs, seeded #482 run; added 3 entries above.
- **2026-09-16** · Wrap-up: added 1 Codebase Patterns entry (seed fixtures only on fresh DB).

## Open Questions
