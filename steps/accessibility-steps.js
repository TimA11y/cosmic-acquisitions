// R9: automated accessibility testing via @axe-core/playwright, run inside
// a real Playwright browser session like everything else in this suite.

import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const { When, Then } = createBdd();

When("I load the Star Map page", async ({ page }) => {
  await page.goto("/index.html");
});

Then("it has no automatic accessibility violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
