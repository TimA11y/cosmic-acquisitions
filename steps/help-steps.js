// Step definitions for features/help.feature.

import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";

const { When, Then } = createBdd();

When("{string} opens How to Play", async ({ page }, playerName) => {
  await page.locator("#how-to-play-button").click();
});

Then("the How to Play dialog is open", async ({ page }) => {
  await expect(page.locator("#help-dialog")).toBeVisible();
});

Then("the How to Play dialog is closed", async ({ page }) => {
  await expect(page.locator("#help-dialog")).toBeHidden();
});

When("Escape is pressed", async ({ page }) => {
  await page.keyboard.press("Escape");
});

Then("the contextual hint is visible", async ({ page }) => {
  await expect(page.locator("#contextual-hint")).toBeVisible();
});

When("the contextual hint is expanded", async ({ page }) => {
  await page.locator("#contextual-hint summary").click();
});

Then("the contextual hint is still expanded", async ({ page }) => {
  const isOpen = await page.locator("#contextual-hint").evaluate((el) => el.open);
  expect(isOpen).toBe(true);
});

// The very first placement of a fresh game is always isolated (nothing else
// is on the board yet), so this deterministically moves the phase from
// placingTile to buyingShares — enough to prove the hint text updates
// without the <details> itself collapsing.
When("the human places any available sector", async ({ page }) => {
  await page.locator("#hand-list button:not([disabled])").first().click();
  await page.locator("#placement-dialog-confirm").click();
});

When("{string} is clicked in the contextual hint", async ({ page }, linkText) => {
  await page.locator("#contextual-hint-text button", { hasText: linkText }).click();
});

Then("the focused element is {string}", async ({ page }, elementId) => {
  const activeId = await page.evaluate(() => document.activeElement.id);
  expect(activeId).toBe(elementId);
});
