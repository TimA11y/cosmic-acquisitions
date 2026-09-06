// Step definitions for features/ui-founding-and-mergers.feature. Unlike
// steps/model-steps.js (which drives js/model/ directly via page.evaluate()
// against a bare test harness page), these click the REAL index.html the
// way a real player would — the founding/merger-survivor/share-disposition
// dialogs this exercises only exist in js/ui/, not in the model layer.
//
// Fixture setup reads/writes window.__getTestGameState()/__setTestGameState
// (see js/ui/main.js) — test-only hooks that let a Given step seed a
// specific board/corporation/share fixture on top of the real game index.html
// already created on load, the same plain-object-spread pattern
// steps/model-steps.js uses against the model harness.

import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";

const { Given, When, Then } = createBdd();

Given("the game is freshly loaded", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => typeof window.__getTestGameState === "function");
});

Given("the board already has an unincorporated sector at {string}", async ({ page }, sectorId) => {
  await page.evaluate((sId) => {
    const state = window.__getTestGameState();
    const nextBoard = new Map(state.board);
    nextBoard.set(sId, { corporationId: null });
    window.__setTestGameState({ ...state, board: nextBoard });
  }, sectorId);
});

Given("{string} has only sector {string} in hand", async ({ page }, playerName, sectorId) => {
  await page.evaluate(
    ({ name, sId }) => {
      const state = window.__getTestGameState();
      window.__setTestGameState({
        ...state,
        players: state.players.map((p) => (p.name === name ? { ...p, hand: [sId] } : p)),
      });
    },
    { name: playerName, sId: sectorId },
  );
});

Given(
  "the corporation {string} already occupies sectors {string}",
  async ({ page }, corporationId, sectorList) => {
    const sectorIds = sectorList.split(",").map((id) => id.trim());
    await page.evaluate(
      ({ cId, ids }) => {
        const state = window.__getTestGameState();
        const nextBoard = new Map(state.board);
        for (const id of ids) nextBoard.set(id, { corporationId: cId });
        window.__setTestGameState({
          ...state,
          board: nextBoard,
          corporations: {
            ...state.corporations,
            [cId]: { ...state.corporations[cId], sectors: new Set(ids) },
          },
        });
      },
      { cId: corporationId, ids: sectorIds },
    );
  },
);

Given("the corporation {string} already occupies {int} sectors", async ({ page }, corporationId, count) => {
  await page.evaluate(
    ({ cId, n }) => {
      const rows = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
      const ids = [];
      for (let col = 1; col <= 12 && ids.length < n; col += 1) {
        for (const row of rows) {
          ids.push(`${col}-${row}`);
          if (ids.length === n) break;
        }
      }
      const state = window.__getTestGameState();
      const board = new Map(state.board);
      for (const id of ids) board.set(id, { corporationId: cId });
      window.__setTestGameState({
        ...state,
        board,
        corporations: {
          ...state.corporations,
          [cId]: { ...state.corporations[cId], sectors: new Set(ids) },
        },
      });
    },
    { cId: corporationId, n: count },
  );
});

Given("{string} already holds {int} shares of {string}", async ({ page }, playerName, count, corporationId) => {
  await page.evaluate(
    ({ name, n, cId }) => {
      const state = window.__getTestGameState();
      window.__setTestGameState({
        ...state,
        players: state.players.map((p) =>
          p.name === name ? { ...p, shares: { ...p.shares, [cId]: n } } : p,
        ),
        bank: {
          ...state.bank,
          sharesRemaining: { ...state.bank.sharesRemaining, [cId]: state.bank.sharesRemaining[cId] - n },
        },
      });
    },
    { name: playerName, n: count, cId: corporationId },
  );
});

When("{string} places sector {string} via the Star Map", async ({ page }, playerName, sectorId) => {
  await page.getByRole("button", { name: `Place Sector ${sectorId}` }).click();
  await page.locator("#placement-dialog-confirm").click();
});

When("{string} founds {string} via the dialog", async ({ page }, playerName, corporationName) => {
  await page.locator("#founding-choice-list button", { hasText: corporationName }).click();
});

When("{string} chooses {string} to survive via the dialog", async ({ page }, playerName, corporationName) => {
  await page.locator("#merger-survivor-choice-list button", { hasText: corporationName }).click();
});

When("{string} confirms the share disposition dialog with default values", async ({ page }, playerName) => {
  await page.locator("#share-disposition-confirm").click();
});

When("{string} ends the game via the button", async ({ page }, playerName) => {
  await page.locator("#end-game-button").click();
});

Then("the founding dialog is open", async ({ page }) => {
  await expect(page.locator("#founding-dialog")).toBeVisible();
});

Then("the merger survivor dialog is open", async ({ page }) => {
  await expect(page.locator("#merger-survivor-dialog")).toBeVisible();
});

Then("the share disposition dialog is open", async ({ page }) => {
  await expect(page.locator("#share-disposition-dialog")).toBeVisible();
});

Then("the turn status reads {string}", async ({ page }, expectedText) => {
  await expect(page.locator("#turn-status")).toHaveText(expectedText);
});

Then("{string} shows {int} sectors in the Market", async ({ page }, corporationName, count) => {
  const row = page.locator("#market-table-body tr", { hasText: corporationName });
  await expect(row.locator("td").nth(2)).toHaveText(String(count));
});

Then("the game over summary is shown", async ({ page }) => {
  await expect(page.locator("#game-over")).toBeVisible();
});

Then("the final standings show {string} with {int} credits", async ({ page }, name, credits) => {
  await expect(page.locator("#final-standings-list")).toContainText(`${name} — ${credits} Credits`);
});
