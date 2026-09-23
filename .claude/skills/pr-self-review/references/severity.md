# Severity

Only **critical** blocks a PR. When unsure between two levels, pick the lower one. A false critical blocks a PR for nothing, and people start working around the skill.

## critical — blocks the PR

Choose critical only when merging this diff as it is would do **real damage**:

- **Security:** injection (SQL, command, prompt without `wrapUntrusted`), XSS, SSRF, auth or tenancy bypass (a query without `workspaceId`), a secret in code or logs.
- **Onion layering:** a *new* import that points outward, per the import matrix in `onion-architecture/SKILL.md`. This covers `drizzle-orm` or `db/schema` in a service or route, an SDK outside `adapters/`, `process.env` outside config, and I/O in `reviewer-core`. Debt already listed in `onion-architecture/references/devdigest-server.md#known-debt` does not count, unless the diff makes it worse.
- **Data:** a migration that loses data, or an edit to an existing migration.
- **Contract:** a change to `@devdigest/shared` that breaks a consumer, or copies of it that drift apart.
- **"Do not touch"** rules from `AGENTS.md`: existing migrations and `server/clones/`. A lockfile changed without its `package.json` counts only as **major** (`hard#lockfile-without-manifest`), because `pnpm dedupe` and transitive updates are legitimate.
- **Tests:** `.only` or `.skip` left in, or a test that calls the real LLM, GitHub or git.
- **Checks** (`--with-checks`): lint, typecheck or tests fail.
- **Obvious runtime crash** on a normal path, such as an unconditional null dereference or an infinite render loop.

## major — warning, fix before merge if you can

- A logic bug that the normal path does not hit (an edge case or an error path).
- An anti-pattern from a skill that changes behaviour: derived state in `useEffect`, a missing effect cleanup, a request waterfall, a missing `key`, `Schema.parse(req.body)` inside a handler, `fetch` inside a component.
- Missing validation at a system boundary.
- Changed behaviour with no test, a missing i18n key, a missing spec for a lesson feature (see `repo-checks.md`).

## minor — worth fixing

Structure and naming conventions, where a file lives, an unneeded `any`, readability that affects maintenance.

## nit — optional

Taste. **Never report more than 3 nits per skill.**

## Anti-noise rules

- Review only **changed lines** and whatever they directly depend on. Do not report old code the diff does not touch.
- A finding without `file:line` and a quote of the code is not a finding.
- Repeated issues: report the first occurrence and write `(+N more in this file)` in `message`.
