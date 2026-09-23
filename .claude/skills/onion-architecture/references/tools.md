# How each backend tool fits the rings

One section per tool in `server/package.json`. Each says which ring may touch the tool and the pattern that keeps it there. API details of the tool itself live in the sibling skills (`fastify-best-practices`, `drizzle-orm-patterns`, `zod`).

## Contents
- [Fastify](#fastify) — driving adapter + composition root
- [Zod and `@devdigest/shared`](#zod-and-devdigestshared) — validation at the edge
- [Drizzle + postgres.js](#drizzle) — driven adapter, transactions
- [External SDKs](#external-sdks) — octokit, simple-git, openai, anthropic, ripgrep, ast-grep, tiktoken, dependency-cruiser
- [Jobs (p-queue) and SSE](#jobs-and-sse)
- [Config and secrets](#config-and-secrets)
- [reviewer-core](#reviewer-core)
- [Testing per ring (vitest, testcontainers)](#testing-per-ring)

---

## Fastify

**Ring:** infrastructure. `routes.ts` is a *driving adapter*; `app.ts` (`buildApp`) is the *composition root*.

- A route handler does four things: let the route `schema` validate input, resolve tenancy with `getContext`, call **one** service method, return its result. Everything else is logic that leaked outward.
- Only `routes.ts` and `app.ts` import from `fastify`. A service never sees `FastifyRequest`, `reply`, or `app.log`; if it needs a logger, pass a `Logger`-shaped parameter (as `run-executor.ts` does).
- HTTP concepts stay in the route: status codes, headers, rate-limit config, SSE stream setup. The service throws `AppError` subclasses; the error handler in `app.ts` maps them to status codes, so services stay HTTP-agnostic.
- `app.decorate('container', …)` exists once, in `app.ts`. Do not add new decorators to carry domain services around — Fastify's encapsulation makes decorators a request-scope/plugin-scope tool, and using them as a DI container hides dependencies inside the framework. Wire services explicitly in `routes.ts` from `app.container`.
- Keep `buildApp` separate from `listen` (`server.ts`) — Fastify's testing guide relies on this so tests can `app.inject()` a fresh instance.

```ts
// ✓ thin driving adapter
app.get('/pulls/:id', { schema: { params: IdParams } }, async (req) => {
  const { workspaceId } = await getContext(app.container, req);
  return service.getDetail(workspaceId, req.params.id);
});

// ✗ query + GitHub call + writes inside the handler (see known debt: pulls/routes.ts)
```

## Zod and `@devdigest/shared`

**Ring:** contract types are ring 1 (shared vocabulary); *parsing* happens at the edge.

- Parse once, at the boundary, then trust the types ("parse, don't validate"). For HTTP the boundary is the route `schema` (`fastify-type-provider-zod`) — never `Schema.parse(req.body)` in a handler, never re-validate in the service.
- Other boundaries parse too: job payloads in the job handler, LLM structured output in `reviewer-core` (`structured.ts`), third-party responses in the adapter that receives them. Whatever crosses into the service is already a typed value.
- Services accept and return contract types (`Agent`, `PrDetail`) or plain input interfaces (`CreateAgentInput`). They do not import `zod` to build schemas.
- Contract fields are `snake_case`; Drizzle rows are `camelCase`. The mapping (`toAgentDto`) is a pure function in `helpers.ts` — ring 1, unit-testable.

## Drizzle

**Ring:** infrastructure (driven adapter). `drizzle-orm`, `db/schema`, and `db/client` values are imported **only** by `repository.ts` / `repository/*.repo.ts`, `db/*`, and the composition root.

### Repository shape
- One repository per module (or per aggregate inside a module, like `reviews/repository/{review,run,pull}.repo.ts`).
- Methods are named after intent (`listOpenPulls(workspaceId, repoId)`, `replacePrSnapshot(prId, files, commits)`), not after SQL (`selectWhere`). The service never assembles `where` clauses.
- Every query takes and filters by `workspaceId` (tenancy invariant).
- Return row types from `db/rows.ts` or contract-shaped objects. Services may `import type` a row from `db/rows.ts` to type data they pass around — that is plain data. They may **not** import table objects (`t.pullRequests`) or operators (`eq`, `and`).
- Constructor takes a `DbExecutor` so the same repository works inside and outside a transaction.

### Transactions
The **service** decides what is atomic (it knows the use case); the **repository** executes it (it knows Drizzle). Two patterns, simplest first:

**A. One aggregate → one repository method.** If all writes belong to one aggregate (a PR and its files/commits), make it one repository method that opens the transaction itself:

```ts
// db/client.ts — add once if missing
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbExecutor = Db | Tx;

// modules/pulls/repository.ts
export class PullsRepository {
  constructor(private db: DbExecutor) {}

  async replacePrSnapshot(prId: string, files: NewPrFile[], commits: NewPrCommit[]) {
    await this.db.transaction(async (tx) => {
      await tx.delete(t.prFiles).where(eq(t.prFiles.prId, prId));
      if (files.length) await tx.insert(t.prFiles).values(files);
      await tx.delete(t.prCommits).where(eq(t.prCommits.prId, prId));
      if (commits.length) await tx.insert(t.prCommits).values(commits);
    });
  }
}

// modules/pulls/service.ts
async refreshDetail(workspaceId: string, prId: string) {
  const pr = await this.deps.repo.getPull(workspaceId, prId);
  if (!pr) throw new NotFoundError('Pull request not found');
  const detail = await (await this.deps.github()).getPullRequest(ref, pr.number); // network: OUTSIDE tx
  await this.deps.repo.replacePrSnapshot(pr.id, toFiles(detail), toCommits(detail)); // DB: one tx
}
```

**B. Writes across repositories.** Give the service a `transaction` dependency that hands it transaction-bound repositories, wired in `routes.ts`:

```ts
// service deps
transaction: <T>(fn: (r: { runs: RunRepository; reviews: ReviewRepository }) => Promise<T>) => Promise<T>;

// routes.ts wiring
transaction: (fn) => app.container.db.transaction((tx) =>
  fn({ runs: new RunRepository(tx), reviews: new ReviewRepository(tx) })),
```

The service still never imports Drizzle, and tests pass `transaction: (fn) => fn({ runs: fakeRuns, reviews: fakeReviews })`.

Rules for both:
- **No network or LLM call inside a transaction.** It holds a pooled connection (`max: 10`) and row locks for the whole remote round trip. Fetch first, then write.
- Nested `tx.transaction()` becomes a savepoint — fine inside one repository, confusing across layers; prefer pattern B over nesting.
- `pgvector` and raw `sql\`\`` fragments are Drizzle details too — same ring, same files.

### Migrations and schema
`db/schema/*.ts` is infrastructure. Changing a column is a repository-ring change plus a contract change; the service changes only if the use case changes. Generate migrations with `pnpm db:generate`, never edit existing ones.

## External SDKs

`octokit`, `simple-git`, `openai`, `@anthropic-ai/sdk`, `@vscode/ripgrep`, `@ast-grep/napi`, `js-tiktoken`, `dependency-cruiser`, `graphology`.

**Ring:** infrastructure (driven adapters). Imported **only** under `src/adapters/<port>/` (and `reviewer-core/src/llm/` for OpenRouter).

- The port interface lives in `vendor/shared/adapters.ts` (or next to its only consumer when it is internal, like `DepGraph`/`Tokenizer` in `adapters/*/index.ts`). It speaks the domain's language: `getPullRequest(ref, number) → PullRequestDetail`, not Octokit's response type.
- SDK types never escape the adapter. Map responses to port types inside the adapter; wrap SDK errors into `ExternalServiceError`/`ConfigError`.
- Construction happens in `platform/container.ts` as a lazy getter, keys from `SecretsProvider`, with a `ContainerOverrides` entry so tests inject `adapters/mocks.ts`.
- Adding a vendor for an existing port (another LLM) = a new adapter + a container branch; no service changes. If a service had to change, the port leaked a vendor detail.

## Jobs and SSE

- **Job handler (p-queue via `platform/jobs.ts`) = driving adapter.** Treat it like a route: parse the payload, call a service method. The work itself is a service method a test can call directly without the queue.
- **Enqueueing a job** is an application decision (service). The service depends on the `JobRunner` *type*; it is passed in, not reached through `Container`.
- **`RunBus` (SSE) = outbound port.** Services/`run-executor` publish domain events on it; the SSE route in `routes.ts` subscribes and streams. Event payloads are contract types from `@devdigest/shared`.
- Boot-time work (stale-run reaping in `app.ts`) is composition-root code calling a service method.

## Config and secrets

**Ring:** composition root only.

- `process.env` is read in `platform/config.ts` (and `LocalSecretsProvider` as its fallback). Nowhere else.
- Secrets are read through `SecretsProvider` inside the container when constructing an adapter. A service never asks for an API key — it receives a ready adapter.
- A service that needs a setting (a limit, a model id) gets the value through its deps, not `AppConfig` as a whole.

## reviewer-core

The innermost ring of the whole backend. Pure: prompt assembly, grounding, structured output, map-reduce, scoring. Its only side effect is the injected `LLMProvider`.

- If a change needs DB, filesystem, env, or GitHub → it belongs in `server/`, and the result is passed in as a resolved value (a string slot, a list) — see `reviewer-core/docs/patterns.md`.
- `server/src/platform/{prompt,grounding,structured}.ts` are re-export shims; fix the engine, not the shim.

## Testing per ring

| Ring | Test kind | How |
|---|---|---|
| Domain (`<noun>.ts`, `helpers.ts`, `reviewer-core`) | hermetic unit, `test/<noun>.test.ts` | plain inputs → outputs, no mocks needed |
| Application (`service.ts`) | unit with fakes | construct the service with explicit deps: fake repository object, `adapters/mocks.ts` for ports, `transaction: (fn) => fn(fakes)` |
| Driven adapter (`repository.ts`) | integration `*.it.test.ts` | real Postgres via `test/helpers/pg.ts` (testcontainers) |
| Driving adapter (`routes.ts`) | integration `*.it.test.ts`, or no-DB smoke | `buildApp({ db, overrides })` + `app.inject()`; see `test/reviews.it.test.ts`, `test/routes-smoke.test.ts` |
| SDK adapter | unit with a stubbed SDK, or contract test | `test/adapters.test.ts` |

If a service test needs Docker, the service is doing a repository's job. If a domain test needs a mock, the function is not pure yet.
