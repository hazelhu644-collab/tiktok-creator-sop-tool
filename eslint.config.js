import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".worktrees", "tsconfig.tsbuildinfo"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // App.tsx holds most of the app's state, and these four rules flag
      // effect and memoization patterns there that need real restructuring
      // rather than a mechanical fix. Kept visible as warnings so they can be
      // worked through deliberately instead of blocking every build.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // A leading underscore is the codebase's marker for a binding that only
      // exists to document a signature, as in `vi.fn(async (_text: string) => …)`.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      // Test doubles legitimately take loosely-typed arguments.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Must stay last: turns off rules that would fight Prettier.
  prettierConfig,
);
