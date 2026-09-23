# Enforcing boundaries with ESLint

Documentation alone doesn't hold the structure; lint does. Two options, lightest first.
`client/` uses Option A since skill 1.1.0 (`client/eslint.config.mjs`). Option B is the upgrade path if relative-path gaps start to matter.

## Option A: core `no-restricted-imports` (no new dependency)

Covers the most common violations: shared code reaching into routes, and deep imports into another route's private folders.

Flat config **replaces** a rule's options per file instead of merging them. If two blocks both configure
`no-restricted-imports` for the same file, only the later one applies, so each file group must list every pattern it needs.

```js
// client/eslint.config.mjs: shape of what's installed (see the file for the exact patterns)
{
  files: ["src/components/**", "src/lib/**"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{ group: ["@/app/*", "**/app/**"], message: "Shared code must not import from routes (app/). Pass data via props." }],
    }],
  },
},
{
  files: ["src/app/**"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{ group: ["@/app/**/_components/**"], message: "Don't import another route's _components. Promote to src/components/ or compose in the route." }],
    }],
  },
},
```
Limitation: it matches import strings, not resolved paths. Relative `../../other-route/_components` imports still get through, so pair it with review.

## Option B: `eslint-plugin-boundaries` (resolved paths, full layer matrix)

```js
import boundaries from "eslint-plugin-boundaries";

{
  plugins: { boundaries },
  settings: {
    "import/resolver": { typescript: { project: "./tsconfig.json" } },
    "boundaries/elements": [
      { type: "route",   pattern: "src/app/**/page.tsx", mode: "file" },
      { type: "feature", pattern: "src/app/**/_components/*", capture: ["name"] },
      { type: "shared",  pattern: "src/components/*" },
      { type: "lib",     pattern: "src/lib/**" },
      { type: "vendor",  pattern: "src/vendor/**" },
    ],
  },
  rules: {
    "boundaries/element-types": ["error", {
      default: "disallow",
      rules: [
        { from: "route",   allow: ["feature", "shared", "lib", "vendor"] },
        { from: "feature", allow: ["shared", "lib", "vendor", ["feature", { name: "${from.name}" }]] },
        { from: "shared",  allow: ["shared", "lib", "vendor"] },
        { from: "lib",     allow: ["lib", "vendor"] },
      ],
    }],
  },
}
```
Check option names against the installed plugin version's docs (https://www.jsboundaries.dev/docs/rules/). The rule set has been renamed across major versions.

## After adding either

Run `pnpm lint` in `client/`. Fix real violations and don't mute them. Record any non-obvious finding in `client/INSIGHTS.md` (engineering-insights skill).
