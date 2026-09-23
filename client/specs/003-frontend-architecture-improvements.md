# 003 — Frontend architecture & quality improvements (refactor, no new features)
Status: done (2026-09-22; e2e flows not re-run locally, see Implementation notes)

## Goal
Bring `client/` in line with the project's frontend skills without changing behaviour:
fix two latent bugs, make routes thin, give every domain rule one home, close convention gaps
(i18n, tests, styles, contracts), and add the missing Next.js safety nets (error/not-found boundaries).
Every item below says **what** is wrong, **where** (`path:line`), **why** (which rule) and **how** to fix it,
so each can be picked up as a separate small PR.

### How this was produced
- Skills applied: `frontend-ui-architecture` 1.0.0 (placement, layers, imports), `react-best-practices`
  (effects, state, keys, a11y), `next-best-practices` (file conventions, RSC boundaries, Suspense, metadata).
- Read: all 8 route files, `lib/`, `lib/hooks/*`, PR-detail and agents components; grep sweeps over all of `src/`
  (vendor excluded) for effects, fetch, keys, `confirm`, inline styles, query keys, tests, relative imports.
- Baseline on 2026-09-22 (must stay green after every PR): `pnpm lint` 0 errors / 13 warnings ·
  `pnpm typecheck` ok · `pnpm test` 16 files / 53 tests pass.
- Paths below are relative to `client/src/`. Line numbers are from that baseline.

### Priority legend
**P0** bug or behaviour risk · **P1** architecture (blocks clean growth) · **P2** quality / conventions · **P3** hygiene.

## Summary

| ID | P | Area | One line |
|---|---|---|---|
| B1 | P0 | React | Every open run accordion mounts its own global `j/k/a/d` handler, so one key press acts on every open panel |
| B2 | P0 | React | `RunStatus.onDone` fires again on every re-render after a run settles |
| A1 | P1 | Arch | Three fat route files hold view logic, derivations and cache wiring |
| A2 | P1 | Arch | Query keys are string literals in 5 files; the page invalidates raw keys |
| A3 | P1 | Arch | Domain rules (severity order, run outcome, blockers, dates) are duplicated or live inside components |
| A4 | P1 | Arch | Hand-written API types in hooks (`ActiveRun`, …) instead of `@devdigest/shared` |
| A5 | P1 | Arch | Shared components with 0–1 consumers; dead `mermaid-diagram`; broken `showcase` claim |
| A6 | P1 | Arch | `AppShell` is owned by the page in 4 routes and by the View in 2 |
| A7 | P1 | Arch | 57 deep relative imports (`../../../../../lib`) while `@/` exists |
| A8 | P1 | Arch | Import boundaries not enforced by lint |
| N1 | P1 | Next | No `error.tsx`, `global-error.tsx`, `not-found.tsx` anywhere |
| N2 | P1 | Next | Root `<Suspense fallback={null}>` wraps the whole app |
| N3 | P2 | Next | All route files are client components; params via `useParams` |
| N4 | P2 | Next | One static `<title>` for every page |
| N5 | P3 | Next | `NEXT_PUBLIC_API_BASE` default defined twice |
| N6 | P2 | Next | `@devdigest/ui` barrel may pull `recharts` into every page chunk (verify) |
| R1 | P2 | React | `ConfigTab`: 9 mirrored `useState` + reset effect with `eslint-disable` |
| R2 | P2 | React | Scroll-to-run implemented as an effect with a nonce prop |
| R3 | P2 | React | `FindingsTab`: 13 props, a raw `UseMutationResult<any…>`, pass-through `useCallback`s |
| R4 | P2 | React | Index keys on dynamic lists (`DiffViewer`, `TraceBody`) |
| R5 | P2 | React | PR list: `status` in URL, but `query`/`sort` in `useState` |
| R6 | P2 | React | `repo-context` value re-created each render; localStorage read in an effect |
| R7 | P2 | a11y | Clickable `div`/`span` rows, nested interactive elements |
| R8 | P2 | UX | `window.confirm` ×4 (3 not translated) |
| I1 | P2 | i18n | Hardcoded user-visible English in 7 files |
| T1 | P2 | Tests | 27 component folders without a test; pure `diff-viewer/comments.ts` untested |
| S1 | P3 | Styles | Inline `style={{…}}` concentrated in 4 files instead of `styles.ts` |
| K1 | P3 | Skills | `react-best-practices` contradicts repo conventions in 4 places |

---

## P0 — bugs

### B1. Global keyboard shortcuts duplicated per open panel
- **Where:** `app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.tsx:52-64`. Each
  `ReviewRunAccordion` renders its own `FindingsPanel` when open (`ReviewRunAccordion.tsx:143-163`), and each
  adds a `window` `keydown` listener.
- **Effect:** with two runs expanded, `a` accepts (and `d` dismisses) the focused finding in **every** open
  panel at once. `j/k` moves focus in all of them.
- **Why:** react-best-practices › Hooks (effects sync *one* external system; the listener's scope is the
  whole window, not the panel).
- **How:** scope shortcuts to one active panel. Preferred: `FindingsTab` owns `activeRunId` (the last
  expanded or clicked run) and passes `shortcutsEnabled={review.run_id === activeRunId}`; `FindingsPanel`
  registers the listener only when enabled. Move the listener into
  `FindingsPanel/useFindingShortcuts.ts` (placement table: UI-only stateful logic → component-folder hook).
- **Accept:** RTL test: two expanded accordions, press `a` → exactly one `POST /findings/:id/accept`.

### B2. `onDone` re-fires after a run settles
- **Where:** `_components/RunStatus/RunStatus.tsx:21-26`. `wasRunning` is never reset, and `onDone` is a new
  inline arrow on every page render (`page.tsx:156-160` → `FindingsTab` → `RunStatus`). After
  `running` turns false, every re-render re-runs the effect and calls `onDone` again, which invalidates
  `pr-active-runs` / `pr-runs` and refetches reviews again. Bounded today only because `RunStatus` unmounts
  once polling reports no active runs (≤4 s).
- **How:** fire once per transition: set `wasRunning.current = false` after calling `onDone`, and read
  `onDone` from a ref so it isn't an effect dependency. Better (see A2): move "run settled → invalidate"
  into the data layer as `useRunSettled(prId)` in `lib/hooks/reviews.ts`, so the page passes nothing.
- **Accept:** unit test: `running` true→false then 3 re-renders → `onDone` called once.

---

## P1 — architecture (`frontend-ui-architecture`)

### A1. Thin routes
Rule: *routes are thin: read params, compose views, wire boundaries* (skill › Core principles #4, Placement › "route's main screen").

| Route | Lines | Logic that must move out |
|---|---|---|
| `app/repos/[repoId]/pulls/[number]/page.tsx` | 185 | PR number→uuid resolution `:35-37`; raw cache invalidation `:51-58`; URL param setter `:62-68`; derived findings `:72-77`; breadcrumbs; `confirm` `:153`; drawer lookup `:178-179` |
| `app/repos/[repoId]/pulls/page.tsx` | 135 | filter/search/sort pipeline `:49-61`; `OPEN_STATUSES` `:25` |
| `app/agents/[id]/page.tsx` | 124 | Entire agent sidebar + header markup, 13 inline style objects, the toggle mutation (duplicates `AgentsListView`) |

**How:**
- Create `_components/PrDetailView/`, `_components/PullsListView/` and `[id]/_components/AgentEditorView/`
  (with test, `index.ts`, `styles.ts`). `page.tsx` shrinks to param reading + `<XView …/>` (see N3).
- `usePullByNumber(repoId, number)` in `lib/hooks/core.ts` wraps the number→id lookup (`usePulls` +
  `usePullDetail`) so no page repeats it.
- The pulls pipeline goes to `PullsListView/helpers.ts` as `filterPulls(pulls, {status, query})`,
  `sortPulls(pulls, sort)`, `countByStatus(pulls)`, all pure and unit-tested.
- URL tab/trace params go to a small `useSearchParamState(key)` hook in `lib/hooks/` (3 pages repeat the
  `new URLSearchParams(…); router.replace(…)` block).
- **Accept:** each `page.tsx` ≤ 40 lines, no `useQueryClient`, no `.filter/.sort/.map` over API data.

### A2. One place for query keys
- **Where:** literal keys in `lib/hooks/{core,reviews,agents,trace,repo-intel}.ts` and, outside hooks,
  `page.tsx:52,57` (`["pr-active-runs", prId]`, `["pr-runs", prId]`).
- **Why:** skill › "Server data → data hook"; TkDodo "Effective React Query Keys" (README source 21): keys and
  their invalidation live together.
- **How:** add `lib/hooks/keys.ts` with a key factory (`qk.pr.runs(prId)`, `qk.pr.activeRuns(prId)`,
  `qk.reviews(prId)`, …) and use it in every hook. Replace the page's invalidation with
  `useRunSettled(prId)` (see B2). `queryOptions()` factories are an allowed next step (README › Decisions),
  not required here.
- **Accept:** `grep -rn queryKey src --exclude-dir=lib` returns nothing.

### A3. Domain rules: one home, typed, tested
Rule: skill › helper vs util vs domain module; Business logic extraction order #1 and #4.

| Rule | Today | Target |
|---|---|---|
| Severity order | `FindingsPanel/constants.ts:4` `SEVERITY_ORDER: Record<string, number>` incl. `INFO` (not in the contract), plus `components/finding-severity/helpers.ts:4` `SEVERITY_KEYS` | `lib/severity.ts`: `SEVERITY_KEYS = Severity.options` from the contract, `severityRank(s)`, `sortBySeverity`, `countBySeverity`, `countBlockers`. `finding-severity` and `FindingsPanel` import from it |
| Blockers | `ReviewRunAccordion.tsx:57` computes `CRITICAL && !dismissed_at` client-side, while `RunHistory` shows server `run.blockers` | One `countBlockers(findings)` in `lib/severity.ts`; document why the two can differ, or use the server field in both |
| Run outcome (matches the CI gate) | `RunHistory.tsx:24-38` `outcomeOf` mixes the rule with colours/icons | `lib/run-outcome.ts` `runOutcome(run): "running" \| "error" \| … \| "approved"` (pure, tested); colour/icon map stays in `RunHistory/constants.ts` |
| Date formatting | `formatWhen` duplicated in `ReviewRunAccordion.tsx:22` and `diff-viewer/CommentCard/CommentCard.tsx:11`; `tsOf` in `RunHistory.tsx:83`; `relativeTime` in `pulls/helpers.ts:11`; raw `toLocaleTimeString()` in `RunHistory.tsx:148,212` (time only, no date for older runs) | `lib/format-date.ts` (`formatDateTime`, `relativeTime`, `toEpoch`), or next-intl `useFormatter()` so the locale follows the app |
| Verdict colours | `ReviewRunAccordion.tsx:16` `VERDICT_COLOR`; `review.verdict.replace("_"," ")` as a label `:94` | Colour map to `constants.ts`; label via i18n key per verdict |

**Accept:** each new `lib/*.ts` has a `*.test.ts`; no component defines severity order, blocker or outcome logic.

### A4. Contracts, not hand-written API types
- **Where:** `lib/hooks/reviews.ts:19` `ActiveRun` (response of `GET /pulls/:id/runs/active`, not in
  `@devdigest/shared`); request inputs `CreateCommentInput :99`, `RunReviewInput :118`,
  `agents.ts:23,42`, `repo-intel.ts:14`.
- **Why:** `client/CLAUDE.md` › "Response types come from `@devdigest/shared`"; root CLAUDE.md › "One contract, one place".
- **How:** add `ActiveRun` (and any request bodies the server validates) to
  `server/src/vendor/shared/contracts/*` first, then sync the client copy and import. Hook-only argument
  shapes that are never sent as-is may stay local.
- **Out of this package:** needs a server-side contract change → separate server spec.

### A5. Shared folder hygiene (promote/demote)

| Folder | Consumers | Action |
|---|---|---|
| `components/mermaid-diagram/` | **0** | Delete, and drop the `mermaid` dependency if nothing else needs it. ⚠️ Confirm no lesson (L02–L08) plans to use it first |
| `components/showcase/` | only `test/smoke.test.tsx` | `vendor/ui/README.md:55` promises a `/showcase` route that doesn't exist. Either add `app/showcase/page.tsx` (dev-only) or fix the README |
| `components/page-shell/` | 1 (`app/page.tsx`) | Keep only if new pages will adopt it (A6); otherwise demote |
| `components/diff-viewer/` | 1 (`DiffTab`) | Keep in shared (large generic widget, cross-lesson reuse expected). Record the exception in `client/docs/structure.md` |

### A6. Who owns `AppShell`
- **Today:** the page wraps `AppShell` in `app/page.tsx`, `pulls/page.tsx`, `[number]/page.tsx` and
  `agents/[id]/page.tsx`; the View does it in `AgentsListView.tsx:28` and `SettingsView.tsx`.
- **Target:** the **View** owns `AppShell` + breadcrumbs (it has the data for crumbs); `page.tsx` stays
  params-only (A1, N3). Apply to all six.

### A7. Import style
- 57 imports climb 3+ levels (`../../../../../lib/hooks/reviews` in `[number]/page.tsx:18-23`,
  `ReviewRunAccordion.tsx:14`, `ConfigTab.tsx:7-9`, `FindingsPanel.tsx:12`, …).
- **How:** codemod to `@/lib/…` / `@/components/…`. Keep `./` and `../` for the component's own folder
  and parent only. New code imports hooks from the domain file (`@/lib/hooks/reviews`), not the barrel.

### A8. Enforce boundaries in lint
- Add Option A from `frontend-ui-architecture/references/lint-boundaries.md` to `eslint.config.mjs`:
  `components/**` and `lib/**` may not import `@/app/**`; no imports of another route's `_components`;
  ban `../../../*` patterns (A7). Current code has **0** violations of the first two, so the rules land
  green and stay that way.

---

## Next.js (`next-best-practices`)

### N1 (P1). Error and not-found boundaries
- **Where:** no `error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx` under `app/`.
- **Effect:** an uncaught render error blanks the page; unknown URLs get the default Next 404 without the shell.
- **How:** add `app/error.tsx` (client, `ErrorState` + `reset()`), `app/global-error.tsx`, and
  `app/not-found.tsx` (inside `AppShell`, i18n). Optional: `repos/[repoId]/error.tsx` to keep the shell on repo errors.
- **Accept:** a test component that throws renders the boundary with a working "Try again".

### N2 (P1). Suspense placement
- **Where:** `app/layout.tsx:29` wraps all of `<Providers>{children}</Providers>` in `<Suspense fallback={null}>`
  to satisfy `useSearchParams` CSR bailout.
- **Effect:** the whole app, shell included, renders nothing until the client bundle loads.
- **How:** remove the root Suspense; wrap only the three `useSearchParams` consumers
  (`pulls/page.tsx`, `[number]/page.tsx`, `agents/[id]/page.tsx`, or their Views after A1) with a skeleton fallback.

### N3 (P2). Route files as server components
- **Today:** all 8 route files start with `"use client"` and read params via `useParams`.
- **How:** after A1, make `page.tsx` a server component
  `export default async function Page({ params }: { params: Promise<{ repoId: string }> })`, `await params`
  and render the client View with props. Data fetching stays client-side (TanStack Query against the local
  API), so this is structural only: thinner routes, typed params, and it enables N4.

### N4 (P2). Per-page titles
- **Today:** one `metadata.title = "DevDigest"` in `layout.tsx:9`; every tab has the same title.
- **How:** use `title.template` in the root layout plus static `metadata` / `generateMetadata` per route
  ("Pull requests", "PR #123", "Agents", "Settings"). Texts come from next-intl `getTranslations`.

### N5 (P3). Single source for the API base URL
- `next.config.mjs` `env.NEXT_PUBLIC_API_BASE` duplicates the default in `lib/api.ts:5-6`. `NEXT_PUBLIC_*`
  vars are inlined automatically. Remove the `env` block and keep the default in one config module.

### N6 (P2, verify first). UI-kit barrel and bundle size
- `vendor/ui/index.ts` `export *` includes `charts` (recharts), `command-palette` and more. Charts are used
  only by `components/showcase`.
- **How:** run `@next/bundle-analyzer` once. If recharts appears in route chunks, import charts from
  `@devdigest/ui/charts` only and drop them from the root barrel (skill › Barrel files). If it doesn't, close the item.

---

## React quality (`react-best-practices`)

### R1. `ConfigTab` form state
- **Where:** `app/agents/[id]/_components/AgentEditor/_components/ConfigTab/ConfigTab.tsx:18-39`: 9 `useState`
  copied from `agent`, then an effect re-copies them on `agent.id` change (`eslint-disable`).
- **How:** remount per agent (`<ConfigTab key={agent.id} …/>` in `AgentEditor`) and keep one form object
  (`useState(() => toForm(agent))` or `useReducer`). Delete the effect and the disable comment.
  `toForm` / `toPatch` go to `ConfigTab/helpers.ts`.
- **Accept:** no `eslint-disable` in the file; a test covers switching agents resets the form.

### R2. Scroll-to-run without an effect
- **Where:** `ReviewRunAccordion.tsx:41-54` (`targetRunId` + `targetNonce` props, effect with `eslint-disable`),
  `FindingsTab.tsx:76-79`.
- **How:** `FindingsTab` owns `openRunIds: Set<string>` (controlled accordions). The timeline click handler
  adds the id and scrolls in the same event (`requestAnimationFrame` →
  `document.getElementById(\`review-run-${id}\`)?.scrollIntoView(...)`). Drop the nonce. This also serves B1's `activeRunId`.

### R3. `FindingsTab` props
- **Where:** `FindingsTab.tsx:12-27` (13 props, including `cancelMutation: UseMutationResult<any, any, string, any>`),
  pass-through `useCallback`s `:52-64` (no memoized children).
- **How:** `FindingsTab` calls `useCancelRun()`, `usePrRuns(prId)` and `useDeleteRun(prId)` itself. Delete the
  forwarding callbacks. Target ≤ 7 props.

### R4. Stable keys
- `components/diff-viewer/DiffViewer/DiffViewer.tsx:28` `key={i}` → `key={f.path}` (files can be filtered or reordered).
- `RunTraceDrawer/_components/TraceBody/TraceBody.tsx:102` `key={i}` → the tool-call id if the contract has one,
  else `${tc.name}:${i}`.
- Static skeleton rows and highlight fragments (`pulls/page.tsx:110`, `PromptModalBody.tsx:25,66`) are fine as they are.

### R5. PR list filter state in the URL
- `pulls/page.tsx:39-47`: `status` is in `?status=`, but `query` and `sort` are `useState` (lost on reload,
  can't be shared). Move both to search params via `useSearchParamState` (A1). Debounce the query write.

### R6. `repo-context`
- `lib/repo-context.tsx:52`: the provider `value` is a new object every render, so every `useActiveRepo()`
  consumer re-renders. Wrap it in `useMemo`.
- `:29-35`: localStorage read via effect + setState (lint warning). Use `useSyncExternalStore` with a
  server snapshot of `null`.

### R7. Accessibility of interactive elements
- `pulls/_components/PRRow/PRRow.tsx:37-41`: the whole row is a `div` with `onClick → router.push`, so there
  is no keyboard access, no middle-click and no "open in new tab". Make the title a `<Link>` and stretch it
  over the row (keep the popover `stopPropagation`). Replace hover `useState` `:24` with CSS `:hover`.
- `RunHistory.tsx:232-240`: delete `span role="button"` has no `tabIndex` or key handler → `<button>`.
- `ReviewRunAccordion.tsx:73-136`: `div role="button"` contains a real `<button>` (nested interactive). Use a
  `<button>` for the toggle and move delete outside it (or use `<details>/<summary>`).

### R8. Confirmation dialogs
- `window.confirm` in `[number]/page.tsx:153`, `ReviewRunAccordion.tsx:119`, `AgentCard.tsx:44`
  and `useShellContext.ts:44` (only the last is translated).
- **How:** one `useConfirm()` in `lib/` backed by a kit modal (i18n title/body/buttons, focus trap, Esc).

---

## I1 (P2). Hardcoded user-visible text
Rule: `client/CLAUDE.md` › "User-visible text goes through next-intl messages".

| File | Examples |
|---|---|
| `app/page.tsx` | "Welcome to DevDigest", "No repositories yet", "Taking you to your repository…" |
| `app/repos/[repoId]/pulls/[number]/page.tsx` | "Pull Requests" crumb `:85`, "Couldn't load this pull request" `:115`, confirm `:153` |
| `app/agents/[id]/page.tsx` | "Agents", "Add", "Create from scratch", "Run on a PR…", "disabled", error texts |
| `app/onboarding/_components/AddRepoView/AddRepoView.tsx` | the entire screen |
| `.../FindingsTab/FindingsTab.tsx` | "Cancel", "Open run trace", "Live review", "Review in progress…", "Lethal Trifecta detected", "{n} finding(s)", "Timeline", "Review runs", empty state |
| `.../ReviewRunAccordion/ReviewRunAccordion.tsx` | "0 findings", manual plural `blocker${…"s"}` `:105`, delete title/confirm |
| `.../RunHistory/RunHistory.tsx` | fallback "Agent" `:184` |

**How:** add keys to the existing namespaces (`prReview`, `agents`, `onboarding`, `common`) with targeted text
edits (INSIGHTS: never JSON load/dump). Use ICU plurals for counts.

## T1 (P2). Tests
Rule: `client/CLAUDE.md` › "Every new `_components/<Name>/` ships with its own `*.test.tsx`". 27 folders have none.
Order by risk (logic first):
1. New pure modules from A1/A3 (`lib/severity`, `lib/run-outcome`, `lib/format-date`, `PullsListView/helpers`).
2. `components/diff-viewer/comments.ts` (173 lines of pure thread-building logic, 0 tests).
3. B1/B2 regressions; `ConfigTab` (R1); `FindingsTab`; `AddRepoView` (submit, error, Esc); `FilterBar`.
4. The remaining presentational folders (`OverviewTab`, `PrDetailHeader`, `SectionTitle`, trace sub-parts),
   as smoke render tests when touched.

## S1 (P3). Styles
Convention: `styles.ts` exports `s`. Inline `style={{…}}` is concentrated in `AddRepoView.tsx` (16),
`RunHistory.tsx` (15, plus 3 module-level `CSSProperties`), `agents/[id]/page.tsx` (13) and
`ReviewRunAccordion.tsx` (11). Move them to `styles.ts` when the file is touched for another item.
Don't start a separate styling PR.

## K1 (P3). Skill conflicts to resolve (separate task)
`react-best-practices` states rules that contradict this repo and `frontend-ui-architecture`:
- "Use utility classes for all styling, no inline `style={}`" vs the repo's `styles.ts` convention.
- "Container components fetch data; presentational components receive props" vs hooks instead of containers.
- "Use the project's `useApiQuery`/`useApiMutation`" and the Axios section: neither exists here.
- "Shared utilities go in `utils/`" vs `lib/<noun>.ts`.

**How:** bump `react-best-practices` with a "Project overrides" note, or scope those sections as generic,
so agents stop getting mixed signals.

---

## Delivery plan (suggested PR order)
Each PR is independently green (`lint → typecheck → test`) and behaviour-preserving, except B1/B2 (bug fixes).

| # | PR | Items | Size |
|---|---|---|---|
| 1 | Keyboard + run-settled fixes | B1, B2 (+ tests) | S |
| 2 | Error / not-found boundaries, Suspense placement | N1, N2 | S |
| 3 | Domain modules + tests | A3 (+ T1.1) | M |
| 4 | Query key factory + `useRunSettled` + `usePullByNumber` + `useSearchParamState` | A2, part of A1 | M |
| 5 | Thin routes, Views own `AppShell`, server `page.tsx`, per-page titles | A1, A6, N3, N4, R5 | L (split per route) |
| 6 | PR-detail components: `FindingsTab` props, controlled accordions, `ConfigTab` form | R1, R2, R3, R4 | M |
| 7 | a11y + confirm dialog | R7, R8 | M |
| 8 | i18n sweep | I1 | M |
| 9 | Imports codemod + lint boundaries | A7, A8 | S |
| 10 | Cleanup: dead shared code, env dup, bundle check, contracts | A5, N5, N6, A4 (server spec first) | S |
| — | Tests and styles | T1, S1: alongside each PR that touches the file | — |

## Out of scope
- New features, visual redesign, switching styling to Tailwind.
- Server-side changes (A4 needs its own server spec).
- `src/vendor/**` (vendored packages): only the barrel question in N6.
- Migrating TanStack hooks to `queryOptions` factories (allowed later, see skill README › Decisions).

## Acceptance criteria
- [x] B1: one key press → one finding action, with 2+ run accordions expanded (RTL test)
- [x] B2: `onDone` fires exactly once per run completion (test)
- [x] Every `page.tsx` ≤ 40 lines: no `useQueryClient`, no filtering/sorting of API data, no inline styles
- [x] No `queryKey` literal outside `src/lib/hooks/`
- [x] Severity order, blockers, run outcome and date formatting each defined once in `src/lib/*.ts` with tests
- [x] `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` exist; root layout has no app-wide `Suspense`
- [x] Each route sets its own title (`/` and `/_not-found` use the app name)
- [x] No hardcoded user-visible strings in the files listed in I1; no `window.confirm` (except the `useConfirm` fallback outside the provider)
- [x] PR rows and run controls reachable and operable by keyboard
- [x] ESLint forbids `app/**` imports from `components/**`/`lib/**`, `@/app/**` imports and 4+ level `../`; 0 violations
- [x] Lint warnings ≤ 13 (baseline): now 2, both in `src/vendor/ui`; no `eslint-disable` left in `src/` outside vendor
- [x] `pnpm lint` → `pnpm typecheck` → `pnpm test` green (165 tests / 57 files, baseline 53 / 16); `pnpm build` green
- [ ] e2e flow: re-run the existing flows in `e2e/specs/` (not run: needs Docker + `agent-browser`; every asserted string/role was checked by code review)

## Implementation notes (2026-09-22)
Implemented in one pass, not as 10 PRs, then checked by an independent review against HEAD.
- **Decisions that differ from the plan:**
  - **A5:** `mermaid-diagram`, `recharts`/`mermaid` and the unused `useContextFiles`, `useReindexContext`, `useRepoIntelStatus`, `useResyncRepoIntel` hooks are **kept**. The README says lessons add these screens, and CLAUDE.md forbids building lesson features into `main`. `FeaturePlaceholder` and `PrRowView` were dead and are removed. The showcase README now points at the gallery; there is no `/showcase` route.
  - **A4:** only `ActiveRun` became a contract (both `shared` copies). Request inputs stay local; `RepoIntelState` stays local by design (see the comment in `repo-intel.ts`).
  - **A7/A8:** the lint rule bans `../../../../` (4+ levels), not 3. The agent editor imports `AgentCard` from its ancestor route with `../../../_components/AgentCard`, which is legitimate.
  - **N6:** checked the production build. `recharts` doesn't reach any client chunk, so nothing changed.
  - **R4:** `TraceBody` tool calls and `FileCard` lines keep index keys: they are append-only or never reorder, and the contract has no ids.
- **Extra bugs found while implementing** (all have tests):
  - The key after `g` in a `g a` chord accepted a finding.
  - `⌘/Ctrl+A` and `⌘/Ctrl+D` triggered finding actions.
  - `DiffTab` showed two error toasts for one failed comment.
  - `CreateAgentModal` had an unhandled promise rejection.
  - The `FileCard`, `TraceSection`, `ToolCallRow` and `PromptBlock` toggles were `div onClick`, so they couldn't be reached by keyboard.
  - `FindingsSection` had its own severity colours.
  - `withCurrentOption` was duplicated in `ConfigTab` and `SettingsModels`.
- **Fixed after the independent review:**
  - A newer run no longer collapses the run being read, and shortcut ownership is stable.
  - A `?q` changed from outside syncs into the search box without a write-back race.
  - The confirm dialog owns the keyboard, allows one question at a time, and answers "no" on navigation.
  - A re-subscribed SSE set counts as running.
  - URL-state writes no longer scroll to the top, except tab switches.
- **Visible changes (intended):**
  - The PR status badge is translated ("Merged", not "merged").
  - Trace findings use the shared SUGGESTION colour.
  - Delete confirmations are an in-app dialog.
  - An unknown `?tab` shows Overview.
  - A non-numeric PR number gives the 404 page.
- **Follow-ups:**
  - Re-run the e2e flows (`./scripts/e2e.sh`).
  - `relativeTime` still returns an untranslated "now".
  - `providers.tsx` falls back to "Something went wrong" (outside React, not translated).
  - `src/vendor/ui` has 2 `set-state-in-effect` warnings (vendored, out of scope).

## Links
- Skills: `.claude/skills/frontend-ui-architecture/` · `.claude/skills/react-best-practices/` · `.claude/skills/next-best-practices/`
- Package docs: `client/docs/structure.md`, `client/docs/patterns.md`, `client/INSIGHTS.md`
- Related specs: `001-run-cost-badge.md`, `002-findings-severity.md`
