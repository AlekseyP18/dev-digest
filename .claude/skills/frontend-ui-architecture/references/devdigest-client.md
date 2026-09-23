# DevDigest `client/` mapping

How the generic layers in SKILL.md map onto `client/src` (Next.js App Router, React 19, TanStack Query, next-intl).
The package's own docs win on conflict: `client/CLAUDE.md`, `client/docs/structure.md`, `client/docs/patterns.md`.

## Layer → path

| Layer | Path | Notes |
|---|---|---|
| Route | `src/app/<route>/page.tsx`, `layout.tsx` | Thin server entry: `await params`, `generateMetadata`, `<Suspense fallback={<PageFallback/>}>` around a View that reads search params. The client View owns `AppShell` |
| Feature | `src/app/<route>/_components/<Name>/` | `_` prefix = private folder, not routable. A "feature" here is a route segment |
| Nested feature parts | `.../_components/<Name>/_components/<Child>/` | Max two levels (see `SettingsView/_components/SettingsApiKeys`) |
| Shared UI | `src/components/<kebab-case>/` | e.g. `run-cost-badge`, `finding-severity`, `diff-viewer`, `app-shell` |
| Data hooks | `src/lib/hooks/<domain>.ts` | `core`, `agents`, `reviews`, `trace`, `repo-intel`; keys only via `qk` in `keys.ts`; URL state via `useSearchParam` in `search-params.ts` |
| API client | `src/lib/api.ts` | The only place that calls `fetch`; owns `API_BASE` |
| Shared utils / domain modules | `src/lib/<noun>.ts` | `severity.ts`, `run-outcome.ts`, `format-date.ts`, `format-cost.ts`, `github-urls.ts`, `model-label.ts`, `keyboard.ts`, `feature-models.ts` |
| Providers / app state | `src/lib/providers.tsx`, `repo-context.tsx`, `theme.tsx`, `toast.tsx`, `confirm.tsx` | |
| Contracts | `@devdigest/shared` → `src/vendor/shared/contracts/*` | Response types come from here, never hand-written |
| Design system | `@devdigest/ui` → `src/vendor/ui/*` | Primitives: `Badge`, `Skeleton`, `EmptyState`, `ErrorState`, `Icon` |
| i18n | `messages/en/<namespace>.json` | All user-visible text |

Import alias: `@/*` → `src/*`.

## Allowed imports

```
app/<route>/page.tsx          → its own _components, components/*, lib/*, vendor/*
app/<route>/_components/X     → its own files and children, components/*, lib/*, vendor/*
                                ✗ another route's _components
components/<kebab>            → lib/*, vendor/*, other components/*   ✗ app/**
lib/**                        → lib/*, vendor/*                        ✗ app/**, components/** (providers excepted)
vendor/**                     → nothing app-level
```

Enforced by `no-restricted-imports` in `client/eslint.config.mjs` (since skill 1.1.0): `components/**` and `lib/**` can't import `app/**`; app code can't use `@/app/**`; no `../../../../` (4+ levels).

## Reference implementations

| Want to see | Read |
|---|---|
| Full component folder (view, test, helpers, constants, styles, index) | `src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/` |
| Pure helper + constants split | `FindingsPanel/helpers.ts` (`visibleFindings`) and `FindingsPanel/constants.ts` (`SEVERITY_ORDER`, `LOW_CONFIDENCE_THRESHOLD`) |
| Promoted shared component with one helper | `src/components/run-cost-badge/` + `src/lib/format-cost.ts` |
| Thin server page + client View with URL state | `src/app/repos/[repoId]/pulls/page.tsx` + `_components/PullsListView/` |
| Domain rule promoted to `lib/` with tests | `src/lib/severity.ts` (+ `severity.test.ts`), `src/lib/run-outcome.ts` |
| Component-folder hook (UI-only logic) | `FindingsPanel/useFindingShortcuts.ts` |
| Shared component with its own local hooks folder | `src/components/app-shell/hooks/` |
| Nested `_components` two levels deep | `src/app/settings/[section]/_components/SettingsView/_components/` |
| Domain data hooks (query, mutation, polling, SSE) | `src/lib/hooks/reviews.ts` |

## Where does X go, in this repo

| X | Path |
|---|---|
| New screen | `app/<route>/page.tsx` (thin server entry) + `app/<route>/_components/<Name>View/` |
| New endpoint call | contract in `vendor/shared/contracts` → key in `lib/hooks/keys.ts` → hook in `lib/hooks/<domain>.ts` → component uses the hook |
| Confirmation before a destructive action | `useConfirm()` from `lib/confirm.tsx` |
| Formatting reused on 2+ screens | `lib/<noun>.ts` + a small shared component in `components/<kebab>/` |
| Column keys / sort orders for one screen | That screen's `constants.ts` |
| Keyboard shortcuts for one panel | Panel's `constants.ts` (key map) + `hooks.ts` or `use<Thing>.ts` |
| Label shown to users | `messages/en/<ns>.json` + `useTranslations("<ns>")` |

## Known deviations (intentional)

- `src/components/diff-viewer/` has one consumer (`DiffTab`). Kept shared as a generic widget expected to be reused by lessons.
- `src/components/mermaid-diagram/` and the hooks `useContextFiles`, `useReindexContext`, `useRepoIntelStatus`, `useResyncRepoIntel` have no consumer yet: starter scaffolding for course lessons. Don't delete them as dead code.
- Data hooks are grouped by **domain** in `lib/hooks/`, not per feature folder. That is intentional here: the same domain queries serve several routes. Don't create hook files inside `_components/` that call `useQuery` directly.
- `src/app/agents/_components/AgentCard` is used by `/agents` and `/agents/[id]`. It lives in their common ancestor route, and the editor imports it with `../../../_components/AgentCard` (an ancestor import, allowed).

Resolved in skill 1.1.0 (spec `client/specs/003-frontend-architecture-improvements.md`): the `lib/hooks/index.ts` barrel was removed, and the PR-list and PR-detail routes are now thin.
