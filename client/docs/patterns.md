# client — patterns

## 1. Add a data hook for a new or changed endpoint
1. Make sure the response schema exists in `src/vendor/shared/contracts/*.ts` (same field the server added; two copies).
   Re-export the type from `src/lib/types.ts` if pages import it from there.
2. Add the key to `qk` in `src/lib/hooks/keys.ts`, then the hook to the matching domain file in `src/lib/hooks/`
   (`core.ts` for settings/repos/pulls, `reviews.ts`, `agents.ts`, `trace.ts`, `repo-intel.ts`).
   Shape: `useQuery({ queryKey: qk.<entity>(id), queryFn: () => api.get<T>(\`/path/${id}\`), enabled: !!id })`.
   Polling while work is in flight: copy `usePrRuns` (`refetchInterval` returns 4000 or false).
3. Mutations invalidate or `setQueryData` on the affected keys inside the hook (`useUpdateSettings`, `useRunReview`);
   components never call `useQueryClient` or spell a key.
4. Import hooks from the domain file (`@/lib/hooks/reviews`); there is no barrel.
5. In tests, mock `fetch` (jsdom, no API) or render the component with fixture props; see `PRRow.test.tsx`.

## 2. Add a screen or a feature component
1. Write `specs/NNN-<feature>.md` (template in `specs/README.md`) naming screens, contract fields, i18n keys, tests, and the e2e flow.
2. Route: create `src/app/<route>/page.tsx` as a thin server entry: `await params`, export `generateMetadata`
   (title from `messages/en/meta.json`), render `_components/<Name>View/` with params as props. If the View reads
   search params (`useSearchParam`), wrap it in `<Suspense fallback={<PageFallback />}>` (`src/app/repos/[repoId]/pulls/page.tsx`).
   The View is `"use client"` and owns `AppShell` + breadcrumbs.
3. Component folder: `_components/<Name>/{<Name>.tsx, <Name>.test.tsx, index.ts, styles.ts, helpers.ts, constants.ts}`.
   Reusable across routes → `src/components/<kebab>/` with an `index.ts` (`src/components/run-cost-badge/index.ts`).
   Pure rules used by 2+ screens → `src/lib/<noun>.ts` with a `*.test.ts` (`src/lib/severity.ts`).
4. UI primitives from `@devdigest/ui` (`Badge`, `Skeleton`, `EmptyState`, `ErrorState`, `Icon`); styles as `satisfies CSSProperties`
   objects in `styles.ts` using CSS variables (`var(--text-secondary)`), see `FindingsPanel/styles.ts`.
5. Strings: add keys to `messages/en/<ns>.json` with a targeted text edit, then `useTranslations("<ns>")`. Plurals use ICU
   (`common.findingsPopover.run`). Check `git diff messages/` for stray reformatting.
6. Test with React Testing Library via `renderWithIntl` from `@/test/intl` (real messages). Mock hooks with
   `vi.mock("@/lib/hooks/<domain>")`. Cover the "unknown/empty" rendering, not only the happy path.
7. If the user journey changes, add or extend a flow in `e2e/specs/NN-<name>.flow.json` and list it in the spec's acceptance criteria.
8. Gate: `pnpm lint` → `pnpm typecheck` → `pnpm test`.

## 3. Show a new field from an existing endpoint (no new request)
1. Add the field to the contract copy in `src/vendor/shared/contracts/<domain>.ts` as `.nullish()`/`.nullable()`.
2. Format it in a pure helper under `src/lib/` (`format-cost.ts`) and render through a small shared component
   (`RunCostBadge`) so PR list, timeline, and drawer stay consistent.
3. Handle `null` explicitly (render "—"); add the column key to `PullsListView/constants.ts` (`COLUMN_KEYS`) and its i18n label.
4. Worked example: `specs/001-run-cost-badge.md` (three surfaces, one helper, one component, four tests).

## Do not
- Call `fetch` in a component or page; go through a hook.
- Put a clickable `onClick` on a `div`/`span`; use `<Link>`/`<button>` (stretched with `.dd-stretched` for whole rows/cards).
- Call `window.confirm`; use `useConfirm()`.
- Listen to single-key shortcuts on `window` from more than one mounted component; guard with `isTextInput` and the `g`-chord (`src/lib/keyboard.ts`).
- Hardcode user-visible text; add an i18n key.
- Reformat `messages/en/*.json` by loading and dumping JSON.
- Add a `set-state-in-effect` site: the rule is `warn` in `eslint.config.mjs` only for the vendored UI kit.
  Read external values with `useSyncExternalStore` (`src/lib/theme.tsx`) or key state by its input (`useRunEvents`).
