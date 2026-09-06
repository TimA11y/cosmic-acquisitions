// Wires Cucumber .feature files into Playwright Test via playwright-bdd
// (R8: "Gherkin .feature files ... executed as real Playwright browser
// sessions"). defineBddConfig() generates real Playwright spec files from
// features/**/*.feature + steps/**/*.js into a gitignored .features-gen/
// directory, which becomes testDir below.

import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

const PORT = 4321;

const testDir = defineBddConfig({
  features: "features/**/*.feature",
  steps: "steps/**/*.js",
});

export default defineConfig({
  testDir,
  webServer: {
    command: `node scripts/test-server.mjs`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
