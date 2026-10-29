import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["dist/", "node_modules/", "tk-browser-tests/", "tmp/", "public/", "supabase/functions/", "config.local.js"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: {
      "no-unused-vars": ["error", { args: "after-used", argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  {
    files: ["tests/**/*.mjs", "vite.config.js", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
