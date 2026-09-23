# client — structure

## Folders
| Path | Purpose |
|---|---|
| `src/app/layout.tsx` | Root layout: next-intl provider, theme no-flash script, `Providers` (React Query + theme + toasts + confirm dialog + active repo), title template from `messages/en/meta.json`. No app-wide Suspense. |
| `src/app/{error,global-error,not-found}.tsx` | Error boundary inside the shell, last-resort boundary, unknown-URL page. |
| `src/app/page.tsx` | `/`: renders `_components/HomeView` (redirects to the first repo's PR list or shows the add-repo empty state). |
| `src/app/<route>/page.tsx` | Thin server entries: await `params`, export `metadata`/`generateMetadata`, wrap views that read search params in `<Suspense fallback={<PageFallback/>}>`, render `_components/<Name>View/`. |
| `src/app/repos/[repoId]/pulls/_components/PullsListView/` | PR list (`?status&q&sort` in the URL): `constants.ts`, `helpers.ts` (`filterPulls`, `sortPulls`, `pullCounts`, `sizeOf`), `styles.ts`, `_components/{PRRow,FilterBar}`. |
| `src/app/repos/[repoId]/pulls/[number]/_components/` | PR detail: `PrDetailView` (`?tab&trace`), `PrDetailHeader`, `OverviewTab`, `DiffTab`, `FindingsTab` (owns open runs + shortcut owner), `ReviewRunAccordion`, `VerdictBanner`, `FindingsPanel` (+ `useFindingShortcuts`), `SeverityFilterPills`, `FindingCard`, `RunHistory`, `RunTraceDrawer`, `RunReviewDropdown`, `RunStatus`. |
| `src/app/agents/` | `_components/{AgentsListView,AgentCard}`; `[id]/_components/{AgentEditorView,AgentEditor}`. |
| `src/app/settings/[section]/_components/SettingsView/` | Settings sections (API keys, models) with nested `_components/`; the section comes from the route param as a prop. |
| `src/app/onboarding/_components/AddRepoView/` | Add-repository screen (`messages/en/addRepo.json`). |
| `src/components/<kebab>/` | Cross-route components: `app-shell` (nav, breadcrumbs, `g`-then-key shortcuts in `hooks/`), `diff-viewer` (one consumer today, kept shared as a generic widget), `finding-severity`, `run-cost-badge`, `page-shell` (`PageContainer`, `PageFallback`), `repo-not-found`, `mermaid-diagram` (starter scaffolding for lessons, no consumer yet), `showcase` (UI-kit gallery rendered by `src/test/smoke.test.tsx`). |
| `src/lib/api.ts` | `API_BASE`, `ApiError`, `apiFetch`, `api.get/post/put/delete`, `runEventsUrl`. The single HTTP client. |
| `src/lib/hooks/` | TanStack Query hooks by domain: `core.ts` (settings, repos, pulls, `usePullByNumber`), `agents.ts`, `reviews.ts` (runs, SSE `useRunEvents`, `useRunSettled`, findings actions), `trace.ts`, `repo-intel.ts`; `keys.ts` (`qk`, every query key); `search-params.ts` (`useSearchParam`). No barrel. |
| `src/lib/` | Pure rules: `severity.ts`, `run-outcome.ts`, `format-date.ts`, `format-cost.ts`, `github-urls.ts`, `model-label.ts`, `keyboard.ts`, `feature-models.ts`. Infrastructure: `providers.tsx`, `repo-context.tsx`, `theme.tsx`, `toast.tsx`, `confirm.tsx`, `types.ts` (re-exports from shared). |
| `src/i18n/` | `messages.ts` loads `messages/en/*.json` into namespaces; `request.ts` is the next-intl config. Single locale `en`, no locale routing. |
| `messages/en/` | One JSON per namespace (`common`, `prReview`, `runs`, `agents`, `settings`, `shell`, `meta`, `errors`, `home`, `addRepo`, …). |
| `src/vendor/shared/` | Local copy of `@devdigest/shared` (see `overview.md`). `src/vendor/ui/` = `@devdigest/ui` design system. |
| `src/test/` | `setup.ts` (jest-dom + `ResizeObserver` stub), `intl.tsx` (`renderWithIntl`, `IntlProvider`, `namespace()`), `diff-fixtures.ts`, `smoke.test.tsx`. |
| `specs/` | Feature contracts: `001-run-cost-badge.md`, `002-findings-severity.md`, `003-frontend-architecture-improvements.md`, template in `README.md`. |

## Entry points
- Dev: `pnpm dev` (:3000). Prod: `pnpm build` then `pnpm start` (what `.github/workflows/e2e-web.yml` runs).
- Config: `next.config.mjs` (next-intl plugin, `NEXT_PUBLIC_API_BASE`), `vitest.config.ts` (jsdom, aliases, `src/**/*.test.{ts,tsx}`), `eslint.config.mjs`, `postcss.config.mjs`.

## Component folder convention
`_components/<Name>/` = `<Name>.tsx` · `<Name>.test.tsx` · `index.ts` · optional `styles.ts` (exports `s`), `helpers.ts`, `constants.ts`.
Optional `hooks.ts` / `use<Thing>.ts` for UI-only stateful logic of that component (`FindingsPanel/useFindingShortcuts.ts`).
Complete example: `src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/`.

## Reference files
- To see a small shared component with i18n and its test, read `src/components/run-cost-badge/RunCostBadge.tsx` and `RunCostBadge.test.tsx`.
- To see a list row that composes hooks, a popover, and a stretched link, read `src/app/repos/[repoId]/pulls/_components/PullsListView/_components/PRRow/PRRow.tsx`.
- To see a thin server `page.tsx` + a View with URL state and loading/error/empty states, read `src/app/repos/[repoId]/pulls/page.tsx` and `.../_components/PullsListView/PullsListView.tsx`.
- To see query, mutation, polling, and SSE hooks for one domain, read `src/lib/hooks/reviews.ts`.
- To see a portaled hover popover with scroll and propagation guards, read `src/components/finding-severity/FindingsPopover.tsx`.
