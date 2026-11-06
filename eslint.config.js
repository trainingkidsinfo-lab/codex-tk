import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const unusedVars = ["error", { args: "after-used", argsIgnorePattern: "^_", caughtErrors: "none" }];

export default [
  {
    ignores: ["dist/", "node_modules/", "tk-browser-tests/", "tmp/", "public/", "supabase/functions/", "config.local.js", "data/database.types.ts"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: { "no-unused-vars": unusedVars },
  },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ["**/*.ts"] })),
  {
    files: ["**/*.ts"],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "@typescript-eslint/no-unused-vars": unusedVars,
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    },
  },
  {
    files: ["tests/**/*.mjs", "vite.config.js", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
