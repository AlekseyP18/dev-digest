---
name: pr-self-review
description: "Pre-PR self-review of all local changes (branch commits + staged + unstaged + untracked): routes each changed file to the matching project skills (UI skills → client/, architecture/backend skills → server/, reviewer-core/), aggregates grounded findings and BLOCKS opening or merging the PR on any critical finding. Use before opening a pull request, before `gh pr create` or `gh pr merge`, when the user says 'open a PR', 'create pull request', 'ready for review', 'push and create PR', 'self-review', 'перевір перед PR', 'відкрий PR', 'створи PR', or runs /pr-self-review."
metadata:
  version: "1.0.0"
  updated: "2026-09-23"
---

# PR Self Review

Reviews **every local change** against the project's own skills before a PR exists. Only a
**critical** finding blocks the PR. Scripts do the deterministic work: collecting the diff,
routing files to skills, hard checks, caching, waivers and the verdict. You and your subagents
do the actual judging.

Arguments (`/pr-self-review …`): `--base <ref>` (default `main`), `--with-checks`, `--no-cache`, `--rerun`.

`S` = `.claude/skills/pr-self-review`. State lives in `.omc/pr-self-review/`, which is gitignored.

## Hard rules

1. **Never run `gh pr create` or `gh pr merge` unless `node S/scripts/gate.mjs` prints `PR creation: ALLOWED`.**
   This applies whenever you are asked to open or merge a PR, even if you think the change is trivial.
2. On `BLOCKED`: list the critical findings with their fixes and stop. Do not suggest ways to open the PR anyway.
   The only way forward is to fix the code, or for a **human** to add a row to `S/waivers.md`.
   You may propose the exact row, but you never write it.
3. A verdict is valid only for the exact diff it was computed on. `gate.mjs` checks this.
   After any edit, run the review again. A PR ships **HEAD**, so the gate also refuses while there
   are uncommitted changes. Before a review meant for opening a PR, ask the user to commit first.
   A review of uncommitted work is fine as a check, but the gate will not accept it.
4. Findings are grounded: `file:line`, a verbatim quote, and the skill rule they break.
   Only changed lines are reviewed. See `references/severity.md`.
5. Every critical finding is checked by a **separate verifier agent** before it counts.
   `finalize.mjs` refuses to run on critical findings that have not been verified.

## Workflow

### 1. Plan
```bash
node .claude/skills/pr-self-review/scripts/plan.mjs [--base main] [--no-cache]
```
It writes `.omc/pr-self-review/plan.json`: the merge-base, the diff-hash, the hard findings, and for each
skill the files `to_review` and the `cached` files, plus `unmapped_skills`.
- If it prints `EXISTING REPORT for this exact diff` and `--rerun` was not passed, show that report
  and go straight to step 6.
- If there are no reviewable changes and no hard findings, go to step 5 with empty `reviews`.

### 2. Review, one reviewer per skill
Use the reviewer template in `references/reviewer-prompt.md`. Run one reviewer for each skill in `plan.reviews`
that has files in `to_review`, and one `repo-checks` reviewer over `plan.repo_checks.files` using `references/repo-checks.md`.
- **Small** (at most 10 reviewable files): review inline. Read each `SKILL.md` and apply it to that skill's files.
- **Larger:** start the reviewers as **parallel subagents** in one message (`oh-my-claudecode:code-reviewer`
  or `general-purpose`). Give each one at most 20 files; a skill with more files gets several reviewers.
- Never review a file for a skill it is not routed to. Routing lives in `S/config.json`.

### 3. Verify every critical finding
For every critical from a reviewer, and every hard finding marked `needs_verification`, start a
**verifier** subagent (`oh-my-claudecode:verifier` or `general-purpose`) with the verifier template.
Run them in parallel. Write the result onto the finding (`verification`, `verified_severity`) or into `hard_verifications`.
Do this even in inline mode: the author of a finding never approves it.

### 4. Checks (only with `--with-checks`)
For each package touched by the diff, run its gate from `<pkg>/CLAUDE.md`.
Run them in the background and in parallel across packages.

| Package | lint | typecheck | test |
|---|---|---|---|
| client | `pnpm lint` | `pnpm typecheck` | `pnpm test` |
| server | `pnpm lint` | `pnpm typecheck` | `pnpm exec vitest run --exclude '**/*.it.test.ts'` |
| reviewer-core | `npm run lint` | `npm run typecheck` | `npm test` |
| e2e | `npm run lint` | `npm run typecheck` | — |

Record each result as `{ "package", "kind": "lint|typecheck|test", "command", "status": "pass|fail", "summary" }`.

### 5. Finalize
Write `.omc/pr-self-review/findings.json`:
```json
{
  "diff_hash": "<plan.diff_hash>",
  "reviews": [ { "skill": "…", "files": ["…"], "findings": [ … ] } ],
  "hard_verifications": { "<hard finding id>": "confirmed | rejected" },
  "checks": [ … ]
}
```
Then run:
```bash
node .claude/skills/pr-self-review/scripts/finalize.mjs
```
- Exit 2 means the input is incomplete or stale. Fix exactly what it lists (a missing reviewed file, an unverified
  critical, a changed working tree) and run it again. If the tree changed, go back to step 1.
- Exit 1 means `BLOCKED`. Exit 0 means `PASS` or `PASS WITH WARNINGS`.
- It writes the report (`.omc/pr-self-review/<branch>-<hash>.md`), `last-verdict.json`, and updates the cache.

### 6. Report to the user
Show the verdict line, the critical and major findings (`file:line` · rule · fix), the counts for the rest,
the warnings (unmapped skills, ignored waivers), and the final `PR creation: …` line. Keep it short;
the full report is in the file.

If the user asked to open or merge the PR: run `gate.mjs`. If it prints `ALLOWED`, continue with `gh pr create`.
Put the verdict line and the counts per skill in the PR body, under a "Self-review" heading.
If it prints `FORBIDDEN`, stop (hard rule 2).

## Maintaining the skill

- **New skill added to `.claude/skills/`:** the report lists it as `Unmapped skill`. Add it to `S/config.json`:
  put it under `skills` with `paths` and/or `content` regexes (matched against added lines), or add it to `toolSkills`.
- **False positive:** first tighten the rule text in `references/severity.md` or `repo-checks.md`. Use a waiver
  only for a one-off. Editing these files, `config.json`, or any file in a skill's folder invalidates the related
  cache entries. So does a rebase, because the merge-base is part of the cache key.
- **Chunks:** a skill split across several reviewers produces several `reviews` entries with the same `skill`.
  That is expected. Each finding's `file` must appear in the `files` list of its own entry.
- **Script tests:** `node --test .claude/skills/pr-self-review/scripts/lib.test.mjs`
