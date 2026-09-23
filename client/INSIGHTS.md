# Insights — client

Non-obvious lessons from working in this package, captured by the `engineering-insights` skill.
Read before a non-trivial change and treat as high-confidence guidance unless told otherwise.
Append-only: add a bullet at the end of a section, never rewrite old ones — a newer entry marks
itself `(supersedes YYYY-MM-DD entry)`. Humans prune periodically.

Entry (every bullet, incl. Session Notes / Open Questions — date AND `path:line` are mandatory):
`- **YYYY-MM-DD** · <what is true> → <what to do> · \`path/from/repo-root.ts:42\``

## What Works
- **2026-09-17** · The PR list table card has `overflow: hidden`, so an absolutely positioned hover panel in a row gets clipped → render popovers via `createPortal` to `document.body` with `position: fixed` from the trigger's rect (see `FindingsPopover`) · `client/src/components/finding-severity/FindingsPopover.tsx:131`
- **2026-09-22** · A window-level shortcut listener in capture phase that calls `stopPropagation()` on every key keeps page shortcuts (`j/k/a/d`, `g`-nav) from firing behind a modal; Enter/Space still activate the focused button because that's a default action, not propagation → do this for any dialog that replaces `window.confirm` · `client/src/lib/confirm.tsx:83`
- **2026-09-22** · Syncing a debounced search box with `?q=`: comparing the URL value to "what we last wrote" alone wipes the text, because `router.replace` lands a render later than our `setWritten` → track the last *seen* URL value too and treat only a URL *change* to something we didn't write as external (regression test in `PullsListView.test.tsx`) · `client/src/app/repos/[repoId]/pulls/_components/PullsListView/PullsListView.tsx:42`

## What Doesn't Work
- **2026-09-17** · Flattening a finding's markdown rationale by stripping `[`*_#>]` mangles identifiers (`sk_live_` → `sklive`) → strip only backticks, `**` and leading `#`/`>` · `client/src/components/finding-severity/FindingPreview.tsx:18`
- **2026-09-17** · Closing a fixed popover on `window` `scroll` in capture phase also fires for scrolls INSIDE the panel, so it closes as soon as the user scrolls its list → ignore events whose target is inside the panel (guard `target instanceof Node` — a window target makes `contains` throw) and add `overscrollBehavior: contain` · `client/src/components/finding-severity/FindingsPopover.tsx:86`
- **2026-09-17** · `borderColor` / `borderWidth` are shorthands in React's eyes, so pairing them with `borderLeftColor` still triggers "Updating a style property during rerender … conflicting property" once the value flips (FindingCard focus changes on severity filter) → spell out all four `border{Top,Right,Bottom,Left}{Color,Width}` · `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/styles.ts:7`
- **2026-09-22** · Two ESLint flat-config blocks that both set `no-restricted-imports` for the same files don't merge: the later block's options replace the earlier ones, so a `components/**` ban silently disappears → give each file group ONE block listing all of its patterns, and check with a throwaway probe file · `client/eslint.config.mjs:9`
- **2026-09-22** · Deciding each run accordion's open state on every render (`override ?? id === reviews[0].id`) collapses the run the user is reading as soon as a newer run's review arrives → record each review's default once, when it first appears (adjust state during render) · `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx:59`

## Codebase Patterns
- **2026-09-16** · Unknown run cost must render "—", never "$0.00" (0 reads as free) → use `formatCost` / `RunCostBadge`, which map null/undefined to a dash · `client/src/lib/format-cost.ts:8`
- **2026-09-17** · React portal events still bubble through the React tree, so a click inside a portaled popover triggers `PRRow`'s `router.push` / the timeline row's handlers → call `stopPropagation` on both the trigger and the panel (`onClick`, `onMouseDown`) · `client/src/components/finding-severity/FindingsPopover.tsx:110`
- **2026-09-22** · The `react-best-practices` skill prescribes Tailwind-only styling, container components, `useApiQuery`/Axios and a `utils/` folder — none of which match this package (styles live in `styles.ts` objects, hooks replace containers, TanStack hooks in `lib/hooks/<domain>.ts`, utils in `lib/<noun>.ts`) → for placement and structure follow `frontend-ui-architecture` and `client/docs/`; take only the effect/state/key/a11y rules from react-best-practices · `.claude/skills/react-best-practices/SKILL.md:115`
- **2026-09-22** · Page-level single-key shortcuts (`a`/`d` on findings) must skip the key that completes the shell's `g`-chord (`g a` = go to Agents) and any ⌘/Ctrl/Alt combo; both used to accept or dismiss a finding → use `G_NAV_PREFIX`/`G_NAV_TIMEOUT_MS`/`isTextInput` from `src/lib/keyboard.ts` · `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/useFindingShortcuts.ts:36`
- **2026-09-22** · `useSearchParam` writes use `router.replace(url, { scroll })` with `scroll: false` by default. Next's default `true` jumps to the top on every debounced search keystroke → pass `{ scroll: true }` only for whole-tab switches · `client/src/lib/hooks/search-params.ts:23`

## Tool & Library Notes
- **2026-09-16** · `messages/en/runs.json` has a hand-indented key (`"copied"`); rewriting the file via a JSON load/dump re-indents it and leaves an unrelated diff hunk → add i18n keys with a targeted text edit, then check `git diff messages/` for stray changes · `client/messages/en/runs.json:71`
- **2026-09-17** · `eslint-plugin-react-hooks` 7.x `recommended` bundles React-Compiler rules; `react-hooks/set-state-in-effect` flags 8 pre-existing sync-in-effect sites (theme, repo-context, command palette…) as errors → keep it at `warn` in `eslint.config.mjs`; fix a site only when you touch that component · `client/eslint.config.mjs:21`
- **2026-09-17** · The rtk hook rewrites `npx eslint …` into a summary, so `-f json | python` gets non-JSON and fails → call `./node_modules/.bin/eslint . -f json -o <file>` and read the file · `client/package.json:9`
- **2026-09-22** · Tests that import `messages/en/*.json` by relative path break whenever a component moves (7–9 `../`), and a namespace missing from the provider only logs `MISSING_MESSAGE` without failing → render with `renderWithIntl` / `namespace()` from `src/test/intl.tsx`, which loads every namespace · `client/src/test/intl.tsx:1`

## Recurring Errors & Fixes

## Session Notes
- **2026-09-16** · Run cost badge on PR list, timeline and trace drawer (spec `specs/001-run-cost-badge.md`); added 1 entry above · `client/specs/001-run-cost-badge.md:1`
- **2026-09-16** · Wrap-up: added 1 Tool & Library note (i18n JSON rewrite reformat) · `client/messages/en/runs.json:71`
- **2026-09-17** · Findings by severity: pills + filter in run cards, timeline icons + popover, PR list FINDINGS column (spec `specs/002-findings-severity.md`); added 3 entries above · `client/specs/002-findings-severity.md:1`
- **2026-09-17** · Findings fixes: list popover per-agent scope, popover scroll, preview layout, severity icons in Review runs header; added 1 entry above · `client/src/components/finding-severity/FindingsPopover.tsx:1`
- **2026-09-17** · ESLint 9 flat config + `lint` script + CI step; one-off normalization of all entries to the mandatory `path:line` format (now fixed in the skill); added 2 entries above · `client/eslint.config.mjs:1`
- **2026-09-20** · Wrote `docs/{README,overview,structure,patterns}.md` and the pointer lines in `CLAUDE.md`; no new entries · `client/docs/README.md:1`
- **2026-09-22** · Frontend audit with frontend-ui-architecture + react/next best-practices skills → improvement spec `specs/003-frontend-architecture-improvements.md` (P0 bugs B1/B2, thin routes, domain modules, boundaries, i18n, tests); added 1 Codebase Pattern + 2 Open Questions · `client/specs/003-frontend-architecture-improvements.md:1`
- **2026-09-22** · Implemented spec 003 end-to-end (thin server pages, `qk` keys, `lib/` domain modules, `useConfirm`, lint boundaries, i18n, a11y, 165 tests); an independent review found 4 regressions, all fixed with tests; e2e not re-run (Docker off); added 2 What Works + 2 What Doesn't Work + 2 Codebase Patterns + 1 Tool note · `client/specs/003-frontend-architecture-improvements.md:1`

## Open Questions
- **2026-09-22** · Found by code reading, not reproduced yet: every expanded `ReviewRunAccordion` mounts a `FindingsPanel` with its own `window` keydown listener, so with 2+ runs open one `a`/`d` press should accept/dismiss the focused finding in each panel → reproduce with two expanded runs before fixing (spec 003 B1) · `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.tsx:52`
- **2026-09-22** · Found by code reading: `RunStatus` never resets `wasRunning` and gets a fresh inline `onDone` each page render, so after a run settles `onDone` (cache invalidation + reviews refetch) likely re-fires on each re-render until polling unmounts it → confirm with a render-count test (spec 003 B2) · `client/src/app/repos/[repoId]/pulls/[number]/_components/RunStatus/RunStatus.tsx:23`
- **2026-09-22** · Both open questions above were reproduced as failing tests on the old code and fixed: B1 (per-panel window listeners) and B2 (`onDone` re-fire) (supersedes 2026-09-22 entries) · `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.test.tsx:1`
- **2026-09-22** · The e2e flows (`./scripts/e2e.sh`) weren't re-run after the spec-003 refactor, because Docker was off and `agent-browser` isn't installed. Asserted strings/roles were checked by review only → run the flows before merging · `e2e/specs/04-pr-findings.flow.json:1`
