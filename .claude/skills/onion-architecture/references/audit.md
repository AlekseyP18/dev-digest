# Layering audit — `rg` commands

One command per rule of the import matrix in `SKILL.md`. Run from `server/`. A hit is a violation **unless** it is already listed in `devdigest-server.md#known-debt` — compare before reporting. On changed files only: append the file list instead of the directory, e.g. `$(git diff --name-only -- src | sed 's#^server/##')`.

Empty output = clean.

```bash
cd server

# R1 — Drizzle / schema / db client values only in repositories, db/, platform/, app.ts
rg -n "from ['\"](drizzle-orm[^'\"]*|[./]+/db/(schema|client)(\.js)?)['\"]" src/modules \
  -g '!**/repository.ts' -g '!**/repository/**' -g '!**/*.repo.ts' \
  | rg -v "import type .*db/client"

# R2 — no DB handle outside repositories (routes may only pass it into `new XRepository(...)`)
rg -n "container\.db\b|\bdb\.(select|insert|update|delete|execute|transaction)\(" src/modules \
  -g '!**/repository.ts' -g '!**/repository/**' -g '!**/*.repo.ts' \
  | rg -v "routes\.ts:[0-9]+:.*new [A-Za-z]+Repository\("

# R3 — SDKs only in src/adapters (and platform/container.ts wiring)
rg -n "from ['\"](octokit|@octokit/[^'\"]+|simple-git|openai|@anthropic-ai/sdk|@vscode/ripgrep|@ast-grep/napi|js-tiktoken|dependency-cruiser|postgres)['\"]" src \
  -g '!src/adapters/**' -g '!src/db/**' -g '!src/platform/container.ts'

# R4 — no concrete adapter imports from modules (ports only)
rg -n "from ['\"][./]+/adapters/" src/modules | rg -v "import type"

# R5 — no Fastify outside routes / app / platform
rg -n "from ['\"](fastify|@fastify/[^'\"]+|fastify-[^'\"]+)['\"]" src/modules \
  -g '!**/routes.ts' -g '!src/modules/index.ts' -g '!src/modules/_shared/**'

# R6 — no env access outside config / secrets (simple-git sets GIT_TERMINAL_PROMPT for its subprocesses — allowed)
rg -n "process\.env" src -g '!src/platform/config.ts' -g '!src/adapters/secrets/**' -g '!src/db/**' \
  -g '!src/server.ts' -g '!src/adapters/git/simple-git.ts'

# R7 — services must not take the whole Container (new code)
rg -n "constructor\([^)]*Container\b" src/modules

# R8 — no cross-module internals (a module importing another module's service/repository/pipeline)
rg -n "from ['\"]\.\./(?!_shared/)[a-z-]+/(service|repository|pipeline|run-executor)" --pcre2 src/modules

# R9 — no Schema.parse in handlers (validation belongs in the route schema)
rg -n "\.(parse|safeParse)\(req\.(body|params|query)" src/modules

# R10 — reviewer-core stays pure
rg -n "from ['\"]((node:)?(fs|fs/promises|child_process|net|http|https)|drizzle-orm|postgres|octokit|simple-git)['\"]|process\.env" ../reviewer-core/src

# R11 — no network call inside a transaction (manual check on hits)
rg -n -A15 "\.transaction\(" src | rg -n "github\(|\.llm\(|\.git\.|fetch\("
```

## Reading results

- **R1/R2 hits in `routes.ts`** → move the query into the module's repository and the orchestration into the service.
- **R3/R4 hits** → a port is missing or a service reached around it. Add or use the port in `vendor/shared/adapters.ts`.
- **R7 hits** → the service is a service-locator consumer; new services take a deps object (`SKILL.md` → "New service").
- **R8 hits** → use `container.agentsRepo` / `container.reviewRepo` / `container.repoIntel`, wired into the service by `routes.ts`.
- Anything a rule flags that is correct by design (e.g. `platform/` itself) belongs in the glob exclusions above — update this file rather than ignoring the hit silently.
