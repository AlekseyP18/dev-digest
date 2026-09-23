# frontend-ui-architecture

**Version:** 1.1.0 · **Updated:** 2026-09-22 · **Scope:** Frontend (React / Next.js)

Agent skill that answers *where does this code go, and what may it import?* It covers component placement, how to split components, constants, helpers vs utils vs lib, business logic, data fetching, state location, dependency direction and barrel files.

Not in scope (use other skills):
- In-component React patterns (hooks misuse, derived state, re-renders): `../react-best-practices/`
- Next.js APIs (RSC boundaries, metadata, route handlers): `../next-best-practices/`
- Testing technique: `../react-testing-library/`

## Files

| File | Loaded | Purpose |
|---|---|---|
| `SKILL.md` | When the skill triggers | Principles, layers, placement table, split rules, workflows, anti-patterns |
| `references/devdigest-client.md` | When working in `client/` | Layer → path mapping, allowed imports, reference implementations, known deviations |
| `references/examples.md` | On demand | Before/after file trees and code |
| `references/lint-boundaries.md` | On demand | ESLint options to enforce the import rules |
| `README.md` | Humans | This file: versioning, decisions, sources |

## Versioning

SemVer in `SKILL.md` → `metadata.version` (the Agent Skills spec keeps custom fields under `metadata`). Bump it together with the changelog below.
- **major**: a rule is reversed or removed (e.g. barrel policy changes)
- **minor**: new rule, section or reference file
- **patch**: wording, links, examples

### Changelog
- **1.1.0** (2026-09-22): `client/` brought in line (spec 003). Mapping updated: thin server pages, `qk` keys, `lib/` domain modules, `useConfirm`, and the lint boundaries now installed. Known deviations reduced to the intentional ones. Lint doc notes that flat config replaces rule options instead of merging them.
- **1.0.0** (2026-09-22): Initial version. Research-based rules, DevDigest `client/` mapping, examples, lint options.

## Decisions taken where sources disagree

| Topic | Sources say | Skill decision | Why |
|---|---|---|---|
| Barrel files | bulletproof-react [10] and TkDodo [22]: avoid. Wieruch [15] and Comeau [25]: `index` per component folder | Single-component `index.ts` allowed; folder-wide barrels avoided | Matches the repo's existing `_components/<Name>/index.ts` convention and still avoids the circular import and perf costs |
| Feature folders | bulletproof [10]: `features/<name>`. FSD [11]: 6 layers. Next.js [1]: unopinionated | Route segment + private `_components/` = feature; `components/` + `lib/` = shared | Next's colocation already gives feature isolation; FSD's layer count is overhead for an app this size [12] |
| Data hooks location | bulletproof [10] and TkDodo [20]: per feature | Per **domain** in `lib/hooks/<domain>.ts` | Same queries serve several routes; this is the existing convention (`client/docs/patterns.md`) |
| Custom query hooks vs `queryOptions` | TkDodo 2024+ [21]: prefer `queryOptions` factories | Keep hooks (repo convention); `queryOptions` is an allowed evolution, not required | Avoids churn; revisit in a minor version |
| Container / presentational | Abramov [23]: retired | Not used; custom hooks instead | Author's own revision; React docs [4] |
| FSD layers (`entities`, `widgets`) | FSD [11] | Not adopted | Overhead without 20+ features [12] |

## Sources

Collected and checked 2026-09-22. **[official]** framework docs · **[reference]** widely adopted architecture · **[opinion]** respected practitioner · **[tooling]** enforcement · **[meta]** skill authoring.

### Official documentation
1. [Next.js: Project Structure](https://nextjs.org/docs/app/getting-started/project-structure) **[official]**: colocation in `app/` is safe, `_private` folders, "unopinionated". Pick one strategy and stay consistent.
2. [Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) **[official]**: put `'use client'` on specific interactive components, pass server UI as `children` to client components, render providers as deep as possible, use `server-only` against environment poisoning.
3. [React: Thinking in React](https://react.dev/learn/thinking-in-react) **[official]**: split by single responsibility; find the minimal state and its owner.
4. [React: Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) **[official]**: hooks hide *how*, components express *intent*.
5. [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) **[official]**: derive during render; wrap unavoidable effects in custom hooks.
6. [React: Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure) **[official]**: group related state, avoid contradictions, redundancy, duplication and deep nesting.
7. [React: Sharing State Between Components](https://react.dev/learn/sharing-state-between-components) **[official]**: lift state to the closest common parent.
8. [React: Keeping Components Pure](https://react.dev/learn/keeping-components-pure) · [Rules of React](https://react.dev/reference/rules) **[official]**: pure render, so business logic belongs in plain functions.
9. [TanStack Query: Query Options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options) **[official]**: `queryOptions` shares `queryKey` + `queryFn` across places while keeping them together.

### Reference architectures
10. [bulletproof-react: Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) · [repo](https://github.com/alan2207/bulletproof-react) **[reference]**: feature modules, no cross-feature imports, `shared → features → app`, no barrels, `import/no-restricted-paths`.
11. [Feature-Sliced Design: Overview](https://feature-sliced.design/docs/get-started/overview) · [Layers](https://feature-sliced.design/docs/reference/layers) · [Slices & segments](https://feature-sliced.design/docs/reference/slices-segments) · [repo](https://github.com/feature-sliced/documentation) **[reference]**: layers, same-layer isolation, segments `ui/api/model/lib/config`, public API per slice.
12. [FSD: Usage with Next.js](https://feature-sliced.design/docs/guides/tech/with-nextjs) · [FSD blog: Next.js App Router architecture](https://feature-sliced.design/blog/nextjs-app-router-guide) **[reference]**: `app/` is routing only, thin pages, name clashes, when FSD is worth it.
13. [Juntao Qiu on martinfowler.com: Modularizing React Applications with Established UI Patterns](https://martinfowler.com/articles/modularizing-react-apps.html) **[reference]**: view → hooks → domain model → gateway; extraction order; strategy over scattered conditionals.
14. [Juntao Qiu on martinfowler.com: Data Fetching Patterns in SPAs](https://martinfowler.com/articles/data-fetch-spa.html) **[reference]**: where fetching lives, avoiding waterfalls.

### Practitioner articles
15. [Robin Wieruch: React Folder Structure](https://www.robinwieruch.de/react-folder-structure/) **[opinion]**: evolution path, one-way flow, promote/demote, ≤2 nesting levels.
16. [Kent C. Dodds: Colocation](https://kentcdodds.com/blog/colocation) **[opinion]**: "place code as close to where it's relevant as possible".
17. [Kent C. Dodds: State Colocation will make your React app faster](https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster) **[opinion]**
18. [Kent C. Dodds: Application State Management with React](https://kentcdodds.com/blog/application-state-management-with-react) **[opinion]**: server cache vs UI state.
19. [Kent C. Dodds: AHA Programming](https://kentcdodds.com/blog/aha-programming) **[opinion]**: avoid hasty abstractions; prefer duplication over the wrong abstraction.
20. [TkDodo: Practical React Query](https://tkdodo.eu/blog/practical-react-query) **[opinion]**: custom hooks around queries, one file per key.
21. [TkDodo: Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys) · [The Query Options API](https://tkdodo.eu/blog/the-query-options-api) **[opinion]**: key/options factories per feature; hooks only when they add logic.
22. [TkDodo: Please Stop Using Barrel Files](https://tkdodo.eu/blog/please-stop-using-barrel-files) **[opinion]**
23. [Dan Abramov: Presentational and Container Components (2019 note)](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0) **[opinion]**
24. [patterns.dev: Container/Presentational Pattern](https://www.patterns.dev/react/presentational-container-pattern/) **[opinion]**
25. [Josh W. Comeau: Delightful React File/Directory Structure](https://www.joshwcomeau.com/react/file-structure/) **[opinion]**
26. [profy.dev: Popular React Folder Structures and Screaming Architecture](https://profy.dev/article/react-folder-structure) **[opinion]**
27. [Sandro Roth: How to structure your React projects](https://sandroroth.com/blog/project-structure/) **[opinion]**
28. [Alex Kondov: Tao of React](https://alexkondov.com/tao-of-react/) **[opinion]**

### Tooling
29. [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries) · [rules docs](https://www.jsboundaries.dev/docs/rules/) **[tooling]**
30. `import/no-restricted-paths` (eslint-plugin-import), as used in [10] **[tooling]**

### Related skills (compared, not duplicated)
31. [vercel-labs/agent-skills: react-best-practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices): performance-focused; not about structure.

### Skill authoring
32. [Anthropic: Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) **[meta]**: third-person "what + when" description, SKILL.md under 500 lines, references one level deep, table of contents for long files, checklists and feedback loops.
33. [Agent Skills specification](https://agentskills.io/specification) **[meta]**: `name` matches the folder, `description` ≤1024 chars, custom fields such as `version` go under `metadata`.
34. [Claude Code: Skills](https://code.claude.com/docs/en/skills) **[meta]**

### Rule → source map

| SKILL.md section | Sources |
|---|---|
| Core principles | 1, 10, 15, 16, 19 |
| Layers | 10, 11, 13, 15 |
| Placement table | 1, 9, 10, 11, 15, 16, 25 |
| helper vs util vs lib vs domain | 10, 11, 13, 16 |
| Component folder | 1, 15, 25 |
| When to split | 3, 13, 23, 28 |
| Business logic extraction order | 5, 8, 13 |
| Barrel files | 10, 22, 25 |
| Anti-patterns | 10, 13, 19, 22 |
| Lint enforcement | 10, 29, 30 |
