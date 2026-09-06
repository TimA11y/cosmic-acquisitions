// Step definitions for features/setup.feature — drives the real setup
// dialog in index.html (player count, names, difficulty) rather than
// bypassing it, since it's the thing under test here.

import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";

const { Given, When, Then } = createBdd();

Given("the setup dialog is open", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#setup-dialog")).toBeVisible();
});

When("the player count is set to {int}", async ({ page }, count) => {
  await page.locator("#setup-player-count").selectOption(String(count));
});

Then("{int} AI opponent rows are shown", async ({ page }, count) => {
  await expect(page.locator(".setup-ai-row")).toHaveCount(count);
});

When("the human name is set to {string}", async ({ page }, name) => {
  await page.locator("#setup-human-name").fill(name);
});

When("AI opponent {int} is named {string}", async ({ page }, index, name) => {
  await page
    .locator(".setup-ai-row")
    .nth(index - 1)
    .locator(".setup-ai-name")
    .fill(name);
});

When("the game is started from the setup dialog", async ({ page }) => {
  await page.locator("#setup-start-button").click();
  await page.waitForFunction(() => window.__getTestGameState() !== null);
});

Then(
  "the game has {int} players named {string}, {string}, {string}",
  async ({ page }, count, name1, name2, name3) => {
    const names = await page.evaluate(() => window.__getTestGameState().players.map((p) => p.name));
    expect(names).toHaveLength(count);
    expect(names).toEqual([name1, name2, name3]);
  },
);
