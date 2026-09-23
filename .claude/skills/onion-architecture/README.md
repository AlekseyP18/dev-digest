# onion-architecture — sources and rationale

Human-facing notes for maintainers of the skill. Claude reads `SKILL.md` and `references/`; this file explains where each rule comes from so it can be challenged and updated.

## Layout

| File | Purpose |
|---|---|
| `SKILL.md` | Principles, ring map, import matrix, "where does this go", workflows, finish checklist |
| `references/tools.md` | How Fastify, Zod, Drizzle, SDKs, jobs/SSE, config, reviewer-core, and tests fit the rings |
| `references/devdigest-server.md` | Real folders per ring, reference files, known-debt table |
| `references/audit.md` | `rg` command per import rule (the only enforcement — no dependency-cruiser/CI by decision) |
| `evals/evals.json` | Test prompts used to iterate the skill with skill-creator |

## Decisions (2026-09-22)

- **Enforcement = skill + `rg` audit only.** No dependency-cruiser config or CI gate for now.
- **Repositories are concrete classes**, not interfaces. Services receive them through an explicit deps object; tests pass structurally compatible fakes. Introduce an interface only when a second real implementation appears. (Trade-off from Palermo's "inner layers define interfaces" vs. the "you might not need the repository pattern" critique.)
- **Existing violations are documented, not fixed** (`references/devdigest-server.md#known-debt`). New code must not add to them.
- **Services get explicit deps, not `Container`** — Fowler's service-locator vs. DI argument; keeps the dependency graph visible and services unit-testable.

## Sources

### Onion / Clean / Hexagonal — the core idea
| Source | What it contributed |
|---|---|
| [Jeffrey Palermo — The Onion Architecture, part 1 (2008)](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) | The four tenets: independent object model at the center; inner layers define interfaces, outer implement; coupling toward the center; infrastructure (DB, UI) at the edge. |
| [Palermo — Onion Architecture part 4: After Four Years (2013)](https://jeffreypalermo.com/2013/08/onion-architecture-part-4-after-four-years/) | Restated tenets; the application core must be compilable and runnable without infrastructure. |
| [Palermo — reference implementation (mirror)](https://github.com/Jordiag/Jeffrey-Palermo-Onion-Architecture) | Concrete project split: Core / Infrastructure / UI with DI wiring at the edge. |
| [Herberto Graça — Onion Architecture](https://herbertograca.com/2017/09/21/onion-architecture/) | How Onion relates to Hexagonal and layered architectures; application vs. domain services. |
| [Oliver Drotbohm — Sliced Onion Architecture](http://odrotbohm.github.io/2023/07/sliced-onion-architecture/) | Package by module first, rings inside each module (principle 5). |
| [Alistair Cockburn — Hexagonal Architecture](https://alistaircockburn.com/Hexagonal-Architecture) | Ports & adapters; driving vs. driven adapters; test harness as just another adapter. |
| [Robert C. Martin — The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) | The Dependency Rule: source dependencies point inward only (principle 1). |
| [Functional Core, Imperative Shell](https://functional-architecture.org/functional_core_imperative_shell/) | Pure domain functions + effectful shell; why `<noun>.ts` helpers need no mocks. |
| [Alexis King — Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/) | Validate once at the boundary, pass typed values inward (Zod section). |
| [Martin Fowler — Inversion of Control Containers and the DI pattern](https://martinfowler.com/articles/injection.html) | Service Locator vs. Dependency Injection — why services should not take `Container`. |

### Node.js / TypeScript practice
| Source | What it contributed |
|---|---|
| [Khalil Stemmler — Clean Node.js Architecture](https://khalilstemmler.com/articles/enterprise-typescript-nodejs/clean-nodejs-architecture/) | Clean/Onion mapped onto TypeScript modules; infrastructure behind interfaces. |
| [André Bazaglia — Clean architecture with TypeScript: DDD, Onion](https://bazaglia.com/clean-architecture-with-typescript-ddd-onion/) | Onion rings in a TS codebase with DI wiring at the edge. |
| [Node.js Best Practices — structure by components, 3 layers](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/projectstructre/createlayers.md) | Entry-points / domain / data-access per component; entry points only adapt payloads and call the domain. |
| [Ports and Adapters explained with two real codebases](https://saadh393.github.io/blog/adapter-port-architecture-two-cases) | "App imports ports, never adapters" as the single rule to keep. |

### Tools
| Source | What it contributed |
|---|---|
| [Fastify — Encapsulation](https://fastify.dev/docs/latest/Reference/Encapsulation/) · [Plugins guide](https://fastify.dev/docs/latest/Guides/Plugins-Guide/) · [Decorators](https://fastify.dev/docs/v5.4.x/Reference/Decorators/) | Plugins/decorators are scoped framework mechanisms; keep domain wiring explicit rather than hiding it in decorators. |
| [Fastify — Testing guide](https://fastify.dev/docs/latest/Guides/Testing/) | Separate `buildApp` from `listen`; `app.inject()` for route tests. |
| [Snyk — Fastify plugins as building blocks](https://snyk.io/blog/fastify-plugins-for-backend-node-js-api/) | Plugin-per-feature structure (our `modules/<m>/routes.ts`). |
| [Drizzle — Transactions](https://orm.drizzle.team/docs/transactions) | `tx` has the same API as `db`; savepoints via nested `tx.transaction`; isolation options. |
| [Sentry — Atomic repositories in Clean Architecture and TypeScript](https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript) | Extract Drizzle's transaction type, repositories accept `tx ?? db` (our `DbExecutor`). |
| [You might not need the repository pattern](https://dev.to/jayfreestone/you-might-not-need-the-repository-pattern-46b) | Counter-argument that shaped the "concrete repository class, no interface" decision. |
| [Drizzle ORM best practices (Paul Serban)](https://paulserban.eu/blog/post/drizzle-orm-best-practices-principles-patterns-and-real-world-case-studies/) | Per-resource repository modules, queries out of handlers. |
| [dependency-cruiser — rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) · [Atomic Object — restrict imports](https://spin.atomicobject.com/dependency-cruiser-imports/) | Shape of forbidden-import rules; our `rg` audit mirrors them without adding tooling. Upgrade path if CI enforcement is wanted. |
| [humen-dev/dev-digest PR #5](https://github.com/humen-dev/dev-digest/pull/5) | Another course fork's onion skill + dep-cruiser rules for the same codebase; compared for coverage. |
