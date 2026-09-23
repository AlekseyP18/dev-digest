---
name: onion-architecture
description: "Onion Architecture for the DevDigest backend (`server/`, `reviewer-core/`): which ring a piece of code belongs to and which way imports may point. Use whenever you add or change a server module, route, service, repository, adapter, background job, or external integration (GitHub, git, LLM, Slack, webhooks…); move logic out of a route; add a DB write that spans several tables or needs a transaction; wire a dependency into the container; decide where validation, config, or secrets are read; choose what kind of test to write; or review backend code for layering. Use it even when the user just says 'add an endpoint', 'where should this go', 'refactor this route', or 'integrate X' without naming the architecture. Not for Fastify API mechanics (fastify-best-practices), query idioms (drizzle-orm-patterns), schema authoring (zod), or physical table design (postgresql-table-design)."
metadata:
  version: "1.0.0"
  updated: "2026-09-22"
---

# Onion Architecture (backend)

Answers two questions for `server/` and `reviewer-core/`: **which ring does this code belong to, and what may it import?**
Sources and the reasoning behind each rule: [README.md](README.md).

| Read | When |
|---|---|
| [references/tools.md](references/tools.md) | Writing code with Fastify, Zod, Drizzle, an SDK, jobs, SSE, config, or tests — how each tool fits its ring |
| [references/devdigest-server.md](references/devdigest-server.md) | Placing code in this repo — the real folders per ring, and the known-debt table |
| [references/audit.md](references/audit.md) | Before finishing, or when reviewing — `rg` commands, one per import rule |

## Core principles

1. **Dependencies point inward.** Code may import from rings closer to the center, never from rings further out. Every other rule here follows from this one.
2. **The domain is the center; Postgres, Fastify, GitHub, and LLM SDKs are details.** They get plugged in at the edge. If a rule of the business changes, only inner code should change; if a vendor changes, only outer code should.
3. **The inner ring owns the interface, the outer ring implements it.** A port (`GitHubClient`, `LLMProvider`) is written in terms of what the core needs, not what the SDK offers. Test doubles are just another adapter.
4. **The core runs with no infrastructure.** `reviewer-core` is the proof: no DB, no filesystem, no env, only an injected `LLMProvider`. Pure module helpers (`pulls/cost.ts`) are tested without Docker.
5. **Modules first, rings inside a module.** The top level is `modules/<feature>/`; rings are the files inside it (`routes.ts` → `service.ts` → `repository.ts`, plus pure `<noun>.ts`). Never create top-level `services/` or `repositories/` folders.
6. **Pragmatic, not ceremonial.** Ring count is not the goal — the import direction is. No interface for a class with one implementation and no second one on the horizon; no DTO copies that add nothing. Add a seam when it buys testability or isolation from a vendor.

## Ring map

From the center outward:

| Ring | Holds | In this repo |
|---|---|---|
| **1. Domain** | Pure rules and calculations: no I/O, no framework, deterministic | `reviewer-core/src`, pure `modules/<m>/<noun>.ts` (`cost.ts`, `severity.ts`), `modules/<m>/helpers.ts`, contract types in `@devdigest/shared` |
| **2. Ports** | Interfaces the application needs from the outside world | `vendor/shared/adapters.ts` (`GitHubClient`, `GitClient`, `LLMProvider`, `CodeIndex`, `Embedder`, `SecretsProvider`, `AuthProvider`), `RepoIntel` facade type |
| **3. Application** | Use cases: orchestrate domain + ports + repositories, own transaction boundaries, enqueue jobs, emit events | `modules/<m>/service.ts`, `modules/reviews/run-executor.ts` |
| **4. Infrastructure** (edge) | Everything that touches a technology | **driving**: `routes.ts`, job handlers, SSE streams · **driven**: `repository.ts` (Drizzle), `adapters/<port>/*` (SDKs) · **composition root**: `platform/container.ts`, `app.ts`, `platform/config.ts` |

`platform/errors.ts` (`AppError`, `NotFoundError`…) is treated as ring 1: any ring may throw these; only `app.ts` maps them to HTTP.

## Import matrix

What each file kind may import. "✗" means the import is a layering violation even if it compiles.

| File | ✓ may import | ✗ must not import |
|---|---|---|
| `<noun>.ts`, `helpers.ts` (domain) | `@devdigest/shared` types, `reviewer-core`, `platform/errors`, same-module `constants.ts` | `fastify`, `drizzle-orm`, `db/*` (except `import type` from `db/rows.ts`), `adapters/*`, SDKs, `process.env`, `Date.now()`/random without an injected parameter |
| `service.ts`, `run-executor.ts` | own `repository.ts`, domain files, port types from `@devdigest/shared`, `reviewer-core`, `platform/errors`, `import type` from `db/rows.ts`, `platform/{jobs,sse}.ts` types | `drizzle-orm`, `db/schema`, `db/client` values, `adapters/*`, `fastify`, SDKs, `process.env`, another module's `service.ts`/`repository.ts` |
| `repository.ts` | `drizzle-orm`, `db/schema`, `db/client` + `db/rows` types, `@devdigest/shared` types, domain files | `fastify`, `adapters/*`, `service.ts`, SDKs, `process.env` |
| `routes.ts` | `fastify`, `fastify-type-provider-zod`, `zod`, `@devdigest/shared` contracts, `_shared/{context,schemas}`, own `service.ts`, `platform/errors` | `drizzle-orm`, `db/schema`, `adapters/*`, SDKs, `process.env`, another module's files |
| `adapters/<port>/*` | the SDK, `@devdigest/shared` port interfaces, `platform/errors` | `modules/*`, `fastify` route code, other adapters' internals |
| `platform/container.ts`, `app.ts` | everything — this is where concrete classes are chosen | — (but nothing inner imports *them* by value) |
| `reviewer-core/src/**` | `zod`, `openai` types, own files | anything in `server/`, `node:fs`, `process.env`, DB, network other than the injected `LLMProvider` |

Cross-module data goes through the shared repositories on the container (`container.agentsRepo`, `container.reviewRepo`) or the `repoIntel` facade — wired into the service by `routes.ts`, never imported from another module's folder.

## Where does this code go?

Ask in order; stop at the first "yes".

1. **Is it a pure calculation or business rule** (given data in, data out, no I/O)? → domain file `modules/<m>/<noun>.ts` with a hermetic unit test. If it is part of reviewing a diff (prompt, grounding, scoring) → `reviewer-core`.
2. **Does it talk to Postgres?** → `repository.ts` of the module that owns the table. The query stays there; the service calls a named method (`listOpenPulls`, `replacePrSnapshot`), never builds a query.
3. **Does it talk to any other external system** (HTTP API, CLI binary, filesystem, LLM)? → a port interface in `vendor/shared/adapters.ts` + an adapter in `adapters/<port>/` + a lazy getter and override on the container + a mock in `adapters/mocks.ts`.
4. **Does it coordinate several of the above for one user intent?** → `service.ts` method. One public method ≈ one use case.
5. **Is it about HTTP** (path, status code, request shape, rate limit, tenancy lookup)? → `routes.ts`.
6. **Is it about choosing implementations, reading env, or starting things?** → composition root (`platform/`, `app.ts`).

## Workflows

### New endpoint
1. Contract first in `@devdigest/shared` (then its client copy).
2. `routes.ts`: Zod schema in `schema:`, `getContext` for `workspaceId`, one call to the service, return the DTO. Aim for a handler under ~15 lines — anything longer is logic leaking outward.
3. `service.ts`: the use case. Throws `NotFoundError`/`AppError`, returns contract-shaped data.
4. `repository.ts`: the query, always filtered by `workspaceId`.
5. Pure math on the result → `<noun>.ts` + `test/<noun>.test.ts`.

### New service (or touching an old one's constructor)
Give it **explicit, narrow dependencies**, not the whole `Container`:

```ts
// modules/pulls/service.ts
export interface PullsDeps {
  repo: PullsRepository;
  github: () => Promise<GitHubClient>;   // port type, resolved lazily
}
export class PullsService {
  constructor(private deps: PullsDeps) {}
}

// modules/pulls/routes.ts — the module's wiring point
const service = new PullsService({
  repo: new PullsRepository(app.container.db),
  github: () => app.container.github(),
});
```

Why: a service that receives `Container` can reach every adapter and `container.db` — the dependency graph becomes invisible and the ring rule unenforceable (a service locator). Explicit deps make the use case's needs readable in one place and let tests pass `{ repo: fake, github: async () => new MockGitHubClient() }` without booting the app. Repositories are passed as classes (pragmatic choice); tests pass any object with the same shape.

### New external integration
1. Port interface in `vendor/shared/adapters.ts`, named by capability (`Notifier`, not `SlackClient`), in domain terms.
2. Adapter `adapters/<port>/<vendor>.ts` implements it; all SDK types stay inside that file.
3. `platform/container.ts`: lazy getter, key from `SecretsProvider`, `ContainerOverrides` entry.
4. `adapters/mocks.ts`: a mock implementing the port.
5. Service depends on the port type only.

### Several writes that must succeed together
The **service decides** that they are one unit; the **repository executes** them in `db.transaction`. Keep network calls (GitHub, LLM, git) outside the transaction — fetch first, then write. Details and the `DbExecutor` pattern: [references/tools.md#drizzle](references/tools.md#drizzle).

### Background job
The job handler is a driving adapter, like a route: parse the payload, call a service method, nothing else. Register it where the service is wired; the service method must also be callable from a test without the queue.

## Existing debt

The repo does not fully follow this yet (Drizzle in some routes, services taking `Container`, no transactions). The list is in [references/devdigest-server.md](references/devdigest-server.md#known-debt). Rules:
- **Do not add new debt.** New code follows the matrix even when the neighbouring code does not.
- **Do not refactor debt you were not asked to touch.** If your change lands in a debt file, put *your* new logic in the right ring and mention the remaining debt in the summary.
- When you pay a debt item off, remove its row from the table.

## Before you finish

- [ ] Every new file is in the ring the decision list above gives.
- [ ] Ran the relevant commands from [references/audit.md](references/audit.md) on changed files; no new hits.
- [ ] Route handlers only parse → call service → return.
- [ ] No `drizzle-orm` / `db/schema` outside `repository.ts` in new code.
- [ ] No SDK import outside `adapters/`.
- [ ] Multi-write use cases are in one transaction, with no network call inside it.
- [ ] Tests match the ring: domain → hermetic unit; service → fakes/mocks; route + repository → `*.it.test.ts`.
- [ ] Summary tells the user which ring each new piece went to, and any debt left in touched files.
