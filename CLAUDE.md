# DevDigest

Local-first AI PR review. Course starter: each lesson (L01–L08) adds one feature as a new
module — do NOT build lesson features into `main`; homework lives in forks/branches.

## Packages (NOT a workspace — each has its own package.json + lockfile)
| Dir | What | Details |
|---|---|---|
| `server/` | Fastify 5 API + Drizzle/Postgres 16 (pgvector) · :3001 | `server/CLAUDE.md` |
| `client/` | Next.js 15 / React 19 studio · :3000 | `client/CLAUDE.md` |
| `reviewer-core/` | Pure review engine: diff → prompt → LLM → grounded findings | `reviewer-core/CLAUDE.md` |
| `e2e/` | Deterministic browser flows (agent-browser, no LLM) | `e2e/CLAUDE.md` |

Shared Zod contracts: `server/src/vendor/shared` (`@devdigest/shared`), wired via tsconfig path aliases.

## Commands
- Full stack from zero: `./scripts/dev.sh` (`--no-seed` · `--no-client` · `--db-only`)
- Only Postgres runs in Docker: `docker compose up -d`
- Node ≥ 22, pnpm ≥ 10 for server/client; reviewer-core and e2e use npm (package-lock.json)
- Run commands inside the package dir — there is no root package.json

## Global rules
- One contract, one place: change a shape in `@devdigest/shared` first, then its consumers.
- Secrets never go to DB or git — `~/.devdigest/secrets.json` via `LocalSecretsProvider`.
- Tests mock the outside world (LLM, GitHub, git); no real keys in tests.
- A feature spec lives in the package that implements it; e2e flows it needs go in its acceptance criteria.

## Do not touch
- Existing `server/src/db/migrations/*` — generate new ones with `pnpm db:generate`
- `server/clones/`, lockfiles (change only via the package manager)

## Read when
- Explaining the product, quick start, or lesson plan → `README.md`
- Writing or placing any test, touching CI → `TESTING.md`
- Editing built-in agent prompts or choosing a model → `docs/agent-prompts/README.md`
- Starting a lesson feature → write/read the spec in `<package>/specs/` first
- Before a non-trivial change in a package → that package's `INSIGHTS.md` (high-confidence guidance unless told otherwise)

## Engineering insights (do not skip)
- The moment something non-obvious is confirmed, and at the end of every meaningful task, run the `engineering-insights` skill — it appends to the touched package's `INSIGHTS.md`.
