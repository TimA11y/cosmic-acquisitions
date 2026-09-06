// Flat config (ESLint 9+ style). Two separate blocks because the shipped
// game code runs in a browser (js/**) while the BDD tooling that exercises
// it runs under Node (steps/**, playwright.config.js, and this file itself)
// — each needs its own global set so ESLint doesn't flag `window`/`document`
// as undefined in one direction or `process`/`import.meta` in the other.

import js from "@eslint/js";
import globals from "globals";

export default [
  // playwright-bdd's generated spec files (regenerated from features/ +
  // steps/, see .gitignore) — not source we maintain, nothing to lint.
  { ignores: [".features-gen/**"] },
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
    },
  },
  {
    files: ["playwright.config.js", "eslint.config.js", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    // Step definitions run under Node (via Playwright Test), but their
    // page.evaluate() callback bodies are function source sent into the
    // browser — so both global sets are legitimately in play in this file.
    files: ["steps/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
