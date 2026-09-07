// Step definitions for features/hard-ai.feature. Reuses steps/medium-ai-
// steps.js's "the human ends their turn" and "the AI grew ... instead of
// placing the isolated sector" — same fixture shape, same assertions, just
// a hard-difficulty AI instead of medium (Cucumber's step registry is
// shared across every steps/*.js file, so those don't need redefining).

import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";

const { Given, When, Then } = createBdd();

Given("the game is freshly loaded with a hard AI opponent", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForSelector("#setup-dialog[open]");
  await page.locator(".setup-ai-row .setup-ai-difficulty").selectOption("hard");
  await page.locator("#setup-start-button").click();
  await page.waitForFunction(() => window.__getTestGameState() !== null);
});

Given(
  "the hard AI holds {int} shares of a corporation it could grow, with an isolated alternative in hand",
  async ({ page }, shareCount) => {
    await page.evaluate((n) => {
      const state = window.__getTestGameState();
      const aiId = state.players.find((p) => !p.isHuman).id;
      const board = new Map(state.board);
      board.set("1-A", { corporationId: "novaTraders" });
      board.set("2-A", { corporationId: "novaTraders" });
      window.__setTestGameState({
        ...state,
        turnPhase: "buyingShares",
        currentPlayerIndex: state.players.findIndex((p) => p.isHuman),
        board,
        corporations: {
          ...state.corporations,
          novaTraders: { ...state.corporations.novaTraders, sectors: new Set(["1-A", "2-A"]) },
        },
        players: state.players.map((p) =>
          p.id === aiId ? { ...p, hand: ["3-A", "12-I"], shares: { ...p.shares, novaTraders: n } } : p,
        ),
      });
    }, shareCount);
  },
);

When("the human ends their turn and the AI's turn is timed", async ({ page }) => {
  const start = Date.now();
  await page.locator("#end-turn-button").click();
  await page.waitForFunction(
    () => {
      const s = window.__getTestGameState();
      return s.players[s.currentPlayerIndex].isHuman;
    },
    { timeout: 10000 },
  );
  page.testState = page.testState || {};
  page.testState.aiTurnDurationMs = Date.now() - start;
});

Then("the AI's turn completed in under {int} seconds", async ({ page }, maxSeconds) => {
  expect(page.testState.aiTurnDurationMs).toBeLessThan(maxSeconds * 1000);
});
