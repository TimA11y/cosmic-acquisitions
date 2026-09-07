// Step definitions for features/medium-ai.feature. Seeds a deterministic
// fixture via window.__getTestGameState()/__setTestGameState (js/ui/main.js
// test hooks) where the medium AI has an obviously-better and an
// obviously-worse legal option, then drives its turn through the real UI
// (clicking End Turn, same as a human would) and inspects the resulting
// gameState — proving the heuristic actually changed behavior versus
// easy's uniform randomness, without needing to unit-test the scoring
// function directly.

import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";

const { Given, When, Then } = createBdd();

Given("the game is freshly loaded with a medium AI opponent", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForSelector("#setup-dialog[open]");
  await page.locator(".setup-ai-row .setup-ai-difficulty").selectOption("medium");
  await page.locator("#setup-start-button").click();
  await page.waitForFunction(() => window.__getTestGameState() !== null);
});

Given(
  "the medium AI holds {int} shares of a corporation it could grow, with an isolated alternative in hand",
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

Given("the medium AI already holds shares alongside two founded corporations", async ({ page }) => {
  await page.evaluate(() => {
    const state = window.__getTestGameState();
    const aiId = state.players.find((p) => !p.isHuman).id;
    const board = new Map(state.board);
    board.set("1-A", { corporationId: "novaTraders" });
    board.set("2-A", { corporationId: "novaTraders" });
    board.set("5-A", { corporationId: "kestrelMining" });
    board.set("6-A", { corporationId: "kestrelMining" });
    window.__setTestGameState({
      ...state,
      turnPhase: "buyingShares",
      currentPlayerIndex: state.players.findIndex((p) => p.isHuman),
      board,
      corporations: {
        ...state.corporations,
        novaTraders: { ...state.corporations.novaTraders, sectors: new Set(["1-A", "2-A"]) },
        kestrelMining: { ...state.corporations.kestrelMining, sectors: new Set(["5-A", "6-A"]) },
      },
      players: state.players.map((p) =>
        p.id === aiId ? { ...p, hand: ["12-I"], shares: { ...p.shares, novaTraders: 3 } } : p,
      ),
    });
  });
});

When("the human ends their turn", async ({ page }) => {
  await page.locator("#end-turn-button").click();
  await page.waitForFunction(
    () => {
      const s = window.__getTestGameState();
      return s.players[s.currentPlayerIndex].isHuman;
    },
    { timeout: 5000 },
  );
});

Then("the AI grew {string} instead of placing the isolated sector", async ({ page }, corporationId) => {
  const result = await page.evaluate(() => {
    const s = window.__getTestGameState();
    return { threeA: s.board.get("3-A"), twelveI: s.board.get("12-I") };
  });
  expect(result.threeA?.corporationId).toBe(corporationId);
  expect(result.twelveI).toBeUndefined();
});

Then("the AI's shares in {string} increased", async ({ page }, corporationId) => {
  const shares = await page.evaluate((cId) => {
    const s = window.__getTestGameState();
    const ai = s.players.find((p) => !p.isHuman);
    return ai.shares[cId] ?? 0;
  }, corporationId);
  expect(shares).toBeGreaterThan(3);
});

Then("the AI's shares in {string} did not increase", async ({ page }, corporationId) => {
  const shares = await page.evaluate((cId) => {
    const s = window.__getTestGameState();
    const ai = s.players.find((p) => !p.isHuman);
    return ai.shares[cId] ?? 0;
  }, corporationId);
  expect(shares).toBe(0);
});
