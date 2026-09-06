// Step definitions for features/save-resume.feature — drives the real
// save/resume/new-game flow in index.html, including a genuine
// page.reload() to prove the save actually survives a real reload rather
// than just a state hand-off within the same page load.

import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";

const { When, Then } = createBdd();

// Hands are dealt randomly by the real setup flow (unlike steps/ui-steps.js's
// seeded fixtures), so this clicks whatever's currently placeable rather
// than a specific known sector id.
When("the human places any sector and ends their turn", async ({ page }) => {
  await page.locator("#hand-list button:not([disabled])").first().click();
  await page.locator("#placement-dialog-confirm").click();
  await page.locator("#end-turn-button").click();
});

When("the page is reloaded", async ({ page }) => {
  await page.reload();
});

Then("the resume dialog is open", async ({ page }) => {
  await expect(page.locator("#resume-dialog")).toBeVisible();
});

Then("the setup dialog is visible", async ({ page }) => {
  await expect(page.locator("#setup-dialog")).toBeVisible();
});

When("{string} resumes the saved game", async ({ page }, playerName) => {
  await page.locator("#resume-game-button").click();
});

When("a new game is started from the resume dialog", async ({ page }) => {
  await page.locator("#new-game-from-resume-button").click();
});

Then("the turn number is at least {int}", async ({ page }, minimum) => {
  const turnNumber = await page.evaluate(() => window.__getTestGameState().turnNumber);
  expect(turnNumber).toBeGreaterThanOrEqual(minimum);
});

When("{string} opens the New Game confirmation", async ({ page }, playerName) => {
  await page.locator("#new-game-button").click();
});

When("cancels the New Game confirmation", async ({ page }) => {
  await page.locator("#confirm-new-game-cancel").click();
});

When("confirms starting a new game", async ({ page }) => {
  await page.locator("#confirm-new-game-start").click();
});

Then("the game is still in progress", async ({ page }) => {
  const state = await page.evaluate(() => window.__getTestGameState());
  expect(state).not.toBeNull();
  await expect(page.locator("#setup-dialog")).not.toBeVisible();
});
