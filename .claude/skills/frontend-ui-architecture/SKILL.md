---
name: frontend-ui-architecture
description: "Frontend UI architecture and code organization for React / Next.js apps: where components, hooks, constants, helpers, utils, types, data fetching and business logic live, how to split components, dependency direction between routes, features and shared code, and when to promote code to shared. Use when creating a new screen, component, hook or helper file, deciding where a piece of code belongs, moving or extracting code, reviewing folder structure or imports, or when the user asks about project structure, colocation, feature folders, barrel files or layering. Not for in-component React patterns (see react-best-practices) or Next.js API details (see next-best-practices)."
metadata:
  version: "1.1.0"
  updated: "2026-09-22"
---

# Frontend UI Architecture

Answers one question: **where does this code go, and what may it import?**
Sources and rationale: [README.md](README.md). Rules are stack-agnostic; how they map onto this repo's `client/` is in [references/devdigest-client.md](references/devdigest-client.md) — read it before placing code in `client/`.

## Core principles

1. **Colocate first.** New code starts in the file or folder of its only consumer. Distance from its consumer must be earned.
2. **Promote on the second consumer, not before.** When a second feature needs it, move it one level up to the nearest common place. When it drops back to one consumer, move it back down. Prefer duplication over the wrong abstraction.
3. **Dependencies flow one way:** `routes/app → features → shared`. Shared never imports a feature; a feature never imports a sibling feature. Features are composed by the route that renders them.
4. **Routes are thin.** A route file (`page.tsx`, `layout.tsx`) reads params, composes feature views, and wires boundaries. No business rules, no fetching logic, no formatting.
5. **Business logic is plain TypeScript.** Rules, calculations, mapping and validation live in pure functions with no React import. Components render; hooks bind logic to React; the API client talks to the network.
6. **Server state ≠ UI state.** Server data lives in the query cache behind data hooks. UI state lives in the lowest component that needs it. A global store holds only truly global client state.
7. **Structure is enforced, not only documented.** Import rules belong in the lint config.

## Layers

| Layer | Contains | May import |
|---|---|---|
| **Route** (`app/<route>/page.tsx`, `layout.tsx`) | Param parsing, composition, error/loading boundaries | Features, shared |
| **Feature** (a route's private `_components/`, or `features/<name>/`) | Views, feature components, feature hooks, `helpers.ts`, `constants.ts`, feature types | Its own files, shared. **Never a sibling feature** |
| **Shared UI** (`components/<kebab>/`) | Components used by 2+ features; no domain fetching | Shared lib, UI kit, contracts |
| **Shared lib** (`lib/`) | API client, data hooks, pure domain/format modules, providers, config | Other shared lib, contracts |
| **Vendor / contracts** | Design system, schemas/types from the backend | Nothing app-level |

Inside one component: **view** (JSX) → **hook** (state, effects, query calls) → **domain function** (pure rules) → **gateway** (API client). Each arrow is one direction only.

## Placement table

| I have… | Put it in | Promote to |
|---|---|---|
| A component used by one parent | Parent's `_components/<Name>/` | `components/<kebab>/` when a 2nd route/feature uses it |
| A route's main screen | `app/<route>/_components/<Name>View/`, rendered by a thin `page.tsx` | — |
| A constant used by one component | That component's `constants.ts` | Feature `constants.ts` → `lib/<noun>.ts` |
| A magic number, threshold, sort order, key map, column list | `constants.ts`, `UPPER_SNAKE_CASE`, `as const` / typed `Record`, with a one-line "why" comment | Same as above |
| User-visible text | i18n messages — **never** a constant | — |
| Env / runtime config | One module that reads `process.env` once and exports typed values | — |
| A pure function used by one component (filter, sort, map, label) | That component's `helpers.ts` | `lib/<noun>.ts` (e.g. `format-cost.ts`) |
| A domain rule used across features (severity rank, cost math, status transitions) | `lib/<domain-noun>.ts`, pure and unit-tested | — |
| Infrastructure (HTTP client, query client, providers, theme) | `lib/` | — |
| Server data read or mutation | A data hook in `lib/hooks/<domain>.ts` via the single API client | — |
| Stateful UI logic used by one component (keyboard nav, toggles, local derived state) | `hooks.ts` or `use<Thing>.ts` in that component's folder | Shared `hooks/` when reused |
| API response types | Imported from the contracts package, not re-declared | — |
| View-model / props types | Next to the component (`<Name>.tsx` or `types.ts`) | `lib/types.ts` when shared |
| Styles | That component's `styles.ts` | Design-system token or primitive |
| Tests | Next to the file under test (`<Name>.test.tsx`, `<noun>.test.ts`) | — |

**helper vs util vs lib vs domain module:**
- `helpers.ts`: pure functions private to one component or feature.
- **util** (`lib/<noun>.ts`): pure, domain-agnostic, used by 2+ features (formatting, dates, URLs). Name the file after what it does (`format-cost.ts`, `github-urls.ts`), never `utils.ts`, `common.ts` or `misc.ts`.
- **domain module** (`lib/<domain>.ts`): pure business rules about a domain concept. Same folder as utils, different content: it encodes *product* decisions, so it gets tests.
- **lib**: configured infrastructure that other code depends on (API client, providers).

## Component folder

```
_components/<Name>/
  <Name>.tsx          # view: JSX + wiring only
  <Name>.test.tsx     # colocated test
  index.ts            # re-exports <Name> only
  styles.ts           # optional, exports `s`
  helpers.ts          # optional, pure functions for this component
  constants.ts        # optional
  hooks.ts            # optional, UI-only stateful logic for this component
  _components/        # optional, children used only by <Name>
```

Only create optional files when they have content. Nest `_components/` at most two levels deep; deeper means the child is a feature of its own or belongs in shared.

## When to split a component

Split when one of these holds, not because of line count alone:
- It has two or more **independent** state groups, or renders sections that load/fail independently.
- A JSX block has a clear name of its own ("header", "row", "empty state") and its own props.
- A branch of conditional rendering is really a different screen or mode.
- A test needs to reach one behavior without setting up the whole thing.
- Logic (not JSX) is growing: extract it to a hook (stateful) or `helpers.ts` (pure), before splitting JSX.

Do **not** split into container/presentational pairs; a custom hook gives the same separation without an extra component.

## Business logic extraction order

When a component mixes concerns, extract in this order and stop when it reads cleanly:
1. **Pure calculations** (derive, filter, sort, map, validate) → `helpers.ts`, or `lib/<domain>.ts` if shared. Unit-test them without React.
2. **Server data** (fetch, cache, mutate, poll) → a data hook in `lib/hooks/<domain>.ts`.
3. **Local stateful UI logic** (effects, subscriptions, keyboard) → `use<Thing>` in the component folder.
4. **Scattered `if (type === …)` across files** → one lookup table or strategy map in the domain module.
5. **Sub-views** → child components in `_components/`.

## Barrel files (`index.ts`)

- **Allowed:** one `index.ts` per component folder that re-exports that single component; a package entry point (`vendor/ui`, contracts).
- **Avoid:** folder-wide barrels that re-export many modules (`export * from` across a directory). They cause circular imports and slower dev and test runs, and they hide where code lives. Import from the file directly.
- Never import through a barrel from inside the same folder; use the relative file path.

## Workflows

**Placing new code:**
```
- [ ] Who is the only consumer today? Put it in that consumer's folder.
- [ ] Is it pure? → helpers.ts / lib/<noun>.ts. Stateful? → hook. JSX? → component.
- [ ] Does it touch the network? → data hook via the API client, never in a component.
- [ ] Is it user-visible text? → i18n.
- [ ] Does any import point sideways (sibling feature) or upward (shared → feature)? Fix it.
- [ ] Is the test next to the file?
```

**Reviewing structure (PR or refactor):**
```
- [ ] Route files contain no business rules or fetch logic.
- [ ] No component calls fetch or builds URLs.
- [ ] No sibling-feature imports; shared code imports nothing from app/routes.
- [ ] Nothing in shared has exactly one consumer (demote it); nothing duplicated 3+ times across features (promote it).
- [ ] No utils.ts / common.ts / misc.ts dumping grounds.
- [ ] No folder-wide barrels added.
- [ ] Constants carry a reason; no hardcoded user-visible strings.
```
If a check fails, fix it and run the checklist again before finishing.

## Anti-patterns

| Anti-pattern | Instead |
|---|---|
| Top-level `components/` holding every component "just in case" | Colocate; promote on the 2nd consumer |
| `utils/index.ts` with unrelated functions | One file per concern, named for what it does |
| Business rules inside JSX or `useEffect` | Pure function + call it during render |
| Feature A importing `../feature-b/_components/X` | Promote `X` to shared, or compose A and B in the route |
| Shared component that calls a feature-specific data hook | Accept data via props; let the feature fetch |
| Duplicate API response interfaces | Import from contracts |
| Premature generic component with many flags | Two concrete components until the shared shape is clear |
| Deep nesting (`_components` 3+ levels) | Flatten or promote |

## More

- **This repo's mapping** (paths, existing examples, known deviations): [references/devdigest-client.md](references/devdigest-client.md)
- **Before/after examples** (file trees, logic extraction, promotion): [references/examples.md](references/examples.md)
- **Enforcing boundaries with ESLint**: [references/lint-boundaries.md](references/lint-boundaries.md)
