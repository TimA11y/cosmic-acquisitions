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
    rules: {
      // Destructuring a key out of an object just to omit it from the rest
      // (js/model/persistence.js's deserialize() stripping schemaVersion
      // before returning gameState) is a deliberate, legitimate pattern —
      // not an unused variable to flag.
      "no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  {
    // Every AI tier (js/ai/easy.js, medium.js, ...) shares one function
    // signature per decision point (see js/ai/index.js's getAiStrategy()),
    // so a simpler tier's implementation can legitimately ignore an
    // argument a smarter tier needs (e.g. easy's chooseCorporationToFound
    // never looks at playerId, only medium does).
    files: ["js/ai/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      "no-unused-vars": ["error", { args: "none" }],
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
    rules: {
      // Cucumber step callbacks receive every {string}/{int} placeholder as
      // a positional argument in order — a step whose Gherkin text captures
      // a value it doesn't need (e.g. a leading "{string}" naming the actor
      // for readability) still has to declare that parameter to reach the
      // ones after it, or in some steps as the sole, purely-documentary arg.
      "no-unused-vars": ["error", { args: "none" }],
    },
  },
];
