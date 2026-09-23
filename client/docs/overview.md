# client — overview

## Responsibility
The studio UI: onboarding (add repo), PR list per repo, PR detail (overview · diff · findings/runs with live SSE
trace), agents list + editor, settings (API keys, models). Next.js 15 App Router: `page.tsx` files are thin
server entries (params, metadata, Suspense) that render a `"use client"` View; Views read the Fastify API
through TanStack Query hooks in `src/lib/hooks/*` over `src/lib/api.ts`.

## What it does NOT do
- No business logic on review data beyond display rules, each defined once in `src/lib/`: severity order,
  counts and blockers (`severity.ts`), run outcome (`run-outcome.ts`), dates (`format-date.ts`), cost (`format-cost.ts`).
  Scores, costs, and PR-level severity counts arrive computed from the API (`PrMeta.score`, `cost_usd`, `severity_counts`).
- No `fetch` inside components. Only `apiFetch` in `src/lib/api.ts`; SSE for run events is opened in `src/lib/hooks/reviews.ts`.
- No server-side data fetching or route handlers: `src/app/**/page.tsx` only await `params`, set `metadata` and render
  a View (`src/app/repos/[repoId]/pulls/[number]/page.tsx`).
- No hand-written API types: everything comes from `@devdigest/shared` via `src/lib/types.ts`.
- No imports from `server/` or `reviewer-core/`. The only cross-package link is HTTP to `NEXT_PUBLIC_API_BASE`.

## Dependencies
| Direction | What | Evidence |
|---|---|---|
| out → `@devdigest/shared` (own copy) | `PrMeta`, `RunSummary`, `ReviewRecord`, `Finding`, `Settings`, … | `src/vendor/shared`, aliased in `tsconfig.json` and `vitest.config.ts`; `src/lib/types.ts` re-exports |
| out → `@devdigest/ui` | primitives, kit, shell, command palette, icons | `src/vendor/ui/index.ts`; used by `src/components/app-shell/AppShell.tsx`, `src/app/repos/[repoId]/pulls/page.tsx` |
| out → server (HTTP) | every endpoint in `README.md` route map | `src/lib/hooks/core.ts`, `reviews.ts`, `agents.ts`, `trace.ts`, `repo-intel.ts` |
| in ← `e2e` | browser flows locate text/roles rendered here | `e2e/specs/*.flow.json` wait on strings like "9,500 tok · $0.014" |
| in ← nothing else | no package imports client code | — |

`src/vendor/shared` is a hand-maintained copy of `server/src/vendor/shared` and currently diverges
(`adapters.ts`, `contracts/{trace,knowledge,eval-ci,productionize}.ts`). Patch the same field into both copies.

## Public interface
- Routes under `src/app/`: `/`, `/onboarding`, `/repos/[repoId]/pulls`, `/repos/[repoId]/pulls/[number]`,
  `/agents`, `/agents/[id]`, `/settings/[section]`. Map with API calls per route: `README.md`.
- Shared components exported from `src/components/<kebab>/index.ts` (e.g. `run-cost-badge`, `finding-severity`, `app-shell`).
- Hooks by domain, imported from the file (`@/lib/hooks/reviews`); no barrel. Query keys only via `qk` in `src/lib/hooks/keys.ts`.
- i18n namespaces = file names in `messages/en/*.json`, merged by `src/i18n/messages.ts`; use `useTranslations("<ns>")`.

## Invariants
- Response types come from `@devdigest/shared`; UI-only view models live next to their component.
- Every `_components/<Name>/` and `src/components/<kebab>/` ships `<Name>.test.tsx`; tests render with the real `messages/en/*.json` via `renderWithIntl` / `namespace()` from `src/test/intl.tsx`.
- User-visible strings go through next-intl; i18n JSON is edited by targeted text edits, never re-serialized (`INSIGHTS.md`).
- Unknown cost renders "—", never "$0.00" (`src/lib/format-cost.ts`).
- Popovers portal to `document.body` and stop propagation so row/card handlers do not fire (`src/components/finding-severity/FindingsPopover.tsx`).
- Clickable rows/cards use a real `<Link>`/`<button>` stretched over the surface (`.dd-stretched` in `src/app/globals.css`), never `div onClick`.
- Destructive actions confirm through `useConfirm()` (`src/lib/confirm.tsx`), never `window.confirm`.
- Only one findings panel owns the window-level `j/k/a/d` shortcuts at a time, and the key after `g` belongs to shell navigation (`src/lib/keyboard.ts`).
- Query defaults: `retry: 1`, `staleTime: 30 s`, no refetch on focus (`src/lib/providers.tsx`); running-run lists poll every 4 s until idle (`src/lib/hooks/reviews.ts`).
- API base is `NEXT_PUBLIC_API_BASE` (default `http://localhost:3001`, defined only in `src/lib/api.ts`); the server's CORS allows only `WEB_PORT`.
- Import boundaries are lint rules (`eslint.config.mjs`): `components/` and `lib/` never import `app/`; no `@/app/**` imports; no 4+ level `../`.
