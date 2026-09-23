// ESLint 9 flat config — TypeScript + React hooks + Next.js rules.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

// 4+ levels up — reaching that far means the import crosses feature boundaries.
const DEEP_RELATIVE = "../../../../*";

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // Pre-existing code relies on these patterns; surface them without failing the gate.
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // Import boundaries (see .claude/skills/frontend-ui-architecture). Flat config
  // replaces — not merges — a rule's options per file, so each block lists all
  // patterns that apply to its files.
  {
    files: ["src/components/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/app/**", "**/app/**"], message: "Shared code (components/, lib/) must not import from routes (app/). Pass data via props." },
            { group: [DEEP_RELATIVE], message: "Use the @/ alias instead of climbing 4+ folders." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/**"],
              message: "Route code imports its own/ancestor folders relatively. Code needed by two routes belongs in src/components or src/lib.",
            },
            { group: [DEEP_RELATIVE], message: "Use the @/ alias instead of climbing 4+ folders." },
          ],
        },
      ],
    },
  },
);
