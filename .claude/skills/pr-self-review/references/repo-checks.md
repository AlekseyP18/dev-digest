# Repo checks (the `repo-checks` reviewer)

DevDigest conventions that the generic skills don't know about. Sources: `AGENTS.md`, `client/AGENTS.md`, `server/CLAUDE.md`, `reviewer-core/CLAUDE.md`, `e2e/CLAUDE.md`, `TESTING.md`.

`plan.mjs` already checks some things deterministically, so **do not report them again**:
- edited migrations;
- lockfiles changed without their manifest;
- `.only` and `.skip`;
- secret patterns;
- drift between the two `@devdigest/shared` copies;
- `*.it.test.ts` naming.

Use `rule` = `repo-checks#<id>` with the ids below.

## client

| id | Check | Severity |
|---|---|---|
| `i18n` | New user-visible text is hardcoded in JSX or `aria-*` instead of going through next-intl. Also: a key used via `t('…')` is missing from `client/messages/en/<ns>.json` | major |
| `component-folder` | A new `_components/<Name>/` lacks `<Name>.tsx`, `index.ts` or `<Name>.test.tsx`. Or a shared component is not in `client/src/components/<kebab-case>/` | minor (missing test → see `tests-alongside`) |
| `no-fetch-in-components` | `fetch`/`api.*` called from a component instead of a hook in `src/lib/hooks/<domain>.ts` | major |
| `hooks-location` | A new data hook lives outside `src/lib/hooks/<domain>.ts`, or a query key outside `src/lib/hooks/keys.ts` | minor |
| `shared-types` | A response type was written by hand instead of imported from `@devdigest/shared` | major |
| `import-boundaries` | `components/` or `lib/` imports from `app/`, or a hook is imported through a barrel | major |

## server

| id | Check | Severity |
|---|---|---|
| `route-validation` | `Schema.parse(req.body/query/params)` in a handler instead of the route's `schema:` | major |
| `module-registered` | New `modules/<name>/routes.ts` without an entry in `modules/index.ts` | critical (route not served) |
| `workspace-scope` | A new repository query on a tenant table without a `workspaceId` filter | critical |
| `repo-intel-facade` | Imports repo-intel internals instead of the `repoIntel.*` facade | major |
| `migration-with-schema` | `db/schema/**` changed but no new migration in `db/migrations/` (or the reverse) | major |

## reviewer-core

| id | Check | Severity |
|---|---|---|
| `purity` | DB, filesystem, env or network access other than the injected `LLMProvider` | critical |
| `untrusted-wrap` | Diff, PR body or repo content goes into a prompt without `wrapUntrusted` | critical |
| `no-denylist` | Adds keyword/denylist injection scanning (the rule is INJECTION_GUARD only) | major |
| `empty-slots` | An optional prompt slot renders when empty, so the prompt no longer matches the baseline | major |
| `public-api` | Exports something outside `src/index.ts` for consumers | minor |

## Cross-package

| id | Check | Severity |
|---|---|---|
| `tests-alongside` | Behaviour changed in `service.ts`, a domain `<noun>.ts`, a component, a hook, or `reviewer-core/src`, and no test next to it changed or was added | major |
| `contract-consumers` | A field in `@devdigest/shared` was renamed or removed while its consumers in `client/`, `server/` or `reviewer-core/` still use the old shape. Grep for the field name | critical |
| `real-outside-world` | A test calls the real LLM, GitHub or git instead of `adapters/mocks.ts` or a fake | critical |
| `e2e-flow` | A user flow or route changed and no flow was added or updated in `e2e/specs/`, while the feature spec requires one | minor |
| `feature-spec` | A new lesson feature (new module or screen) has no spec in `<pkg>/specs/NNN-<feature>.md` | major |
| `naming` | Naming breaks the conventions in `AGENTS.md`: server module dirs `kebab-case`, constants `UPPER_SNAKE_CASE`, API/contract fields `snake_case`, i18n keys `camelCase` | minor |
