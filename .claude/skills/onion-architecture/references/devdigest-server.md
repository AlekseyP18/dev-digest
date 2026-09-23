# DevDigest server — rings in the real code

Paths are relative to `server/`. Verified 2026-09-22.

## Folder → ring

| Path | Ring | Notes |
|---|---|---|
| `../reviewer-core/src/**` | 1 Domain | The pure engine. Imported via tsconfig alias. |
| `src/modules/<m>/<noun>.ts` (`pulls/cost.ts`, `pulls/severity.ts`, `pulls/status.ts`, `reviews/findings.ts`) | 1 Domain | Pure helpers with hermetic tests (`test/pulls-*.test.ts`). |
| `src/modules/<m>/helpers.ts`, `constants.ts` | 1 Domain | Row → DTO mapping, constants. Must stay free of `drizzle-orm`/`db/schema`. |
| `src/vendor/shared/contracts/*.ts` | 1 Domain | Zod contracts = shared vocabulary. Mirrored by hand into `client/`. |
| `src/platform/errors.ts` | 1 Domain | Error taxonomy; mapped to HTTP only in `app.ts`. |
| `src/vendor/shared/adapters.ts` | 2 Ports | `LLMProvider`, `Embedder`, `GitHubClient`, `GitClient`, `CodeIndex`, `AuthProvider`, `SecretsProvider`. |
| `src/modules/repo-intel/types.ts` (`RepoIntel`) | 2 Ports | Facade other modules read repo-intel through. |
| `src/adapters/{depgraph,tokenizer}/index.ts` interfaces | 2 Ports | Internal ports used by the indexer pipeline only. |
| `src/modules/<m>/service.ts`, `reviews/run-executor.ts`, `repo-intel/service.ts` | 3 Application | Use cases. |
| `src/modules/repo-intel/pipeline/*` | 3 Application | Indexer orchestration; private to repo-intel. |
| `src/modules/<m>/routes.ts` | 4 Driving | HTTP adapter + module wiring point. |
| `src/modules/<m>/repository.ts`, `reviews/repository/*.repo.ts` | 4 Driven | Drizzle. |
| `src/adapters/<port>/*` | 4 Driven | SDK adapters; `mocks.ts` = test adapters. |
| `src/db/*` | 4 Driven | Schema, client, migrations, seed. `db/rows.ts` types may be imported with `import type` by inner rings. |
| `src/platform/{container,config,jobs,sse,price-book,run-logger,trace-builder}.ts`, `src/app.ts`, `src/server.ts` | 4 Composition root | Chooses implementations, reads env. `jobs.ts`/`sse.ts` types may be referenced by services. |
| `src/modules/index.ts` | 4 Composition root | Static module registry. |
| `src/modules/_shared/context.ts` | 4 Driving | Tenancy lookup for routes. |

## Reference files to copy from

| Want | Read |
|---|---|
| Route with Zod params/body on the type provider | `src/modules/agents/routes.ts` |
| Repository with workspace-scoped, intent-named methods | `src/modules/agents/repository.ts` |
| Pure helper + hermetic test | `src/modules/pulls/cost.ts` + `test/pulls-cost.test.ts` |
| Port + adapter + lazy getter + override | `GitHubClient` in `src/vendor/shared/adapters.ts` → `src/adapters/github/octokit.ts` → `Container.github()` → `MockGitHubClient` |
| Service receiving narrow deps (closest existing) | `ReviewRunExecutor` constructor in `src/modules/reviews/run-executor.ts` (takes repositories explicitly) |
| Route integration test | `test/reviews.it.test.ts` |

## Known debt

The code below predates this skill. Leave it unless the task is about it; do not copy its pattern into new code. Remove a row when it is fixed.

| # | Where | Violation | Target |
|---|---|---|---|
| D1 | `src/modules/pulls/routes.ts:40`, `:92`, `:134`, `:204` | Drizzle queries in route handlers (list, detail, severity/cost rollups) | `PullsService` + `PullsRepository` |
| D2 | `src/modules/pulls/routes.ts:221-245` | `GET /pulls/:id` fetches GitHub and deletes/inserts `prFiles`/`prCommits` as separate statements, no transaction | service `refreshDetail`; repo `replacePrSnapshot` in one tx (see `tools.md#transactions`) |
| D3 | `src/modules/polling/routes.ts:22` | Drizzle in route | polling service + repository |
| D4 | `src/modules/settings/routes.ts:30`, `src/modules/settings/feature-models.ts:41` | Drizzle in route / helper that takes `Container` | settings repository |
| D5 | `src/modules/workspace/routes.ts:18` | Drizzle in route | workspace repository |
| D6 | `src/modules/{agents,repos,reviews,repo-intel}/service.ts` (constructors) | Services take the whole `Container` (service locator) and build their own repository from `container.db`; reach adapters via `this.container.llm/git` | explicit deps object wired in `routes.ts` |
| D7 | `src/modules/reviews/run-executor.ts:5`, `src/modules/reviews/diff-loader.ts:4` | Import `db/schema` for `typeof schema.repos.$inferSelect` | `import type { RepoRow } from '../../db/rows.js'` (add the alias there) |
| D8 | `src/modules/repos/helpers.ts:2` | Domain `helpers.ts` imports `db/schema` (only for `typeof t.repos.$inferSelect` in `toRepoDto`) | same fix as D7: `import type { RepoRow }` from `db/rows.ts` |
| D10 | `src/modules/repo-intel/service.ts:22,28`, `repo-intel/pipeline/{full,incremental}.ts`, `src/modules/reviews/diff-loader.ts:3` | Import functions straight from `adapters/` (`astgrep` parsers wrap `@ast-grep/napi`; `codeindex/extract.ts`, `git/diff-parser.ts` are pure text parsers) | ast-grep → a port on the container like `DepGraph`; pure parsers → move to a domain file (they have no SDK) |
| D11 | `src/modules/reviews/routes.ts:32` | `RunRequest.parse(req.body ?? {})` in the handler instead of `schema: { body }` | route schema with `.default({})` |
| D9 | whole `src/` | zero `db.transaction` calls — multi-write use cases are non-atomic | add `Tx`/`DbExecutor` to `db/client.ts` when the first transaction is introduced |

Refresh the table with the commands in `audit.md`.
