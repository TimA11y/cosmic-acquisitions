// Shared step definitions for js/model/'s representative BDD pass. Every
// scenario drives the real engine inside a real browser page (loaded from
// test/model-harness.html), per R8/docs/file-layout.md's testing note —
// nothing here imports js/model/ directly in Node.
//
// Game state for a scenario lives in the page's `window.gameState`, mutated
// in place across steps via page.evaluate() calls into the engine's pure
// functions (each call reassigns window.gameState to the function's return
// value, since the functions themselves don't mutate). Player ids are just
// the display names passed to "a new game with players ...", and
// corporation ids are the camelCase ids from requirements.md's glossary
// (e.g. "novaTraders"), used directly rather than display names, to avoid
// a name-to-id lookup layer these tests don't need.

import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";

const { Given, When, Then } = createBdd();

// --- Setup (Given) ----------------------------------------------------

Given("a new game with players {string} and {string}", async ({ page }, name1, name2) => {
  await page.goto("/test/model-harness.html");
  await page.waitForFunction(() => window.modelReady === true);
  page.testState = { creditsBefore: {} };
  await page.evaluate(
    ({ n1, n2 }) => {
      window.gameState = window.CosmicModel.createGame([
        { id: n1, name: n1, isHuman: true },
        { id: n2, name: n2, isHuman: false },
      ]);
      window.lastError = null;
    },
    { n1: name1, n2: name2 },
  );
});

Given("{string} is holding only sector {string}", async ({ page }, playerId, sectorId) => {
  await page.evaluate(
    ({ pId, sId }) => {
      window.gameState = {
        ...window.gameState,
        players: window.gameState.players.map((p) => (p.id === pId ? { ...p, hand: [sId] } : p)),
      };
    },
    { pId: playerId, sId: sectorId },
  );
});

Given("sector {string} is placed and unincorporated", async ({ page }, sectorId) => {
  await page.evaluate((sId) => {
    const nextBoard = new Map(window.gameState.board);
    nextBoard.set(sId, { corporationId: null });
    window.gameState = { ...window.gameState, board: nextBoard };
  }, sectorId);
});

// Directly assigns an explicit list of sectors to a corporation, bypassing
// placeTile entirely — mirrors how docs/game-engine-api.md's own example
// scenario is phrased ("Given two corporations are each 10 sectors"), i.e.
// establishing pre-existing world state rather than replaying full turns.
Given("{string} occupies sectors {string}", async ({ page }, corporationId, sectorList) => {
  const sectorIds = sectorList.split(",").map((id) => id.trim());
  await page.evaluate(
    ({ cId, ids }) => {
      const nextBoard = new Map(window.gameState.board);
      for (const id of ids) nextBoard.set(id, { corporationId: cId });
      window.gameState = {
        ...window.gameState,
        board: nextBoard,
        corporations: {
          ...window.gameState.corporations,
          [cId]: { ...window.gameState.corporations[cId], sectors: new Set(ids) },
        },
      };
    },
    { cId: corporationId, ids: sectorIds },
  );
});

// A block of N sectors along one row, starting at a given column — used to
// build two adjacent secure (11+) corporations for dead-tile scenarios.
Given(
  "{string} occupies {int} contiguous sectors in row {string} starting at column {int}",
  async ({ page }, corporationId, count, row, startColumn) => {
    await page.evaluate(
      ({ cId, n, r, startCol }) => {
        const ids = Array.from({ length: n }, (_, i) => `${startCol + i}-${r}`);
        const nextBoard = new Map(window.gameState.board);
        for (const id of ids) nextBoard.set(id, { corporationId: cId });
        window.gameState = {
          ...window.gameState,
          board: nextBoard,
          corporations: {
            ...window.gameState.corporations,
            [cId]: { ...window.gameState.corporations[cId], sectors: new Set(ids) },
          },
        };
      },
      { cId: corporationId, n: count, r: row, startCol: startColumn },
    );
  },
);

// Bulk sector count without caring about exact layout — used for the
// endgame scenario, where only the sector COUNT (41+) matters.
Given("{string} occupies {int} sectors", async ({ page }, corporationId, count) => {
  await page.evaluate(
    ({ cId, n }) => {
      const ids = window.CosmicModel.getAllSectorIds().slice(0, n);
      const nextBoard = new Map(window.gameState.board);
      for (const id of ids) nextBoard.set(id, { corporationId: cId });
      window.gameState = {
        ...window.gameState,
        board: nextBoard,
        corporations: {
          ...window.gameState.corporations,
          [cId]: { ...window.gameState.corporations[cId], sectors: new Set(ids) },
        },
      };
    },
    { cId: corporationId, n: count },
  );
});

// Sets a player's holding directly, and removes the matching count from the
// bank's remaining supply so the synthetic state stays internally
// consistent (total issued shares never exceeds SHARE_CAP).
Given("{string} holds {int} shares of {string}", async ({ page }, playerId, count, corporationId) => {
  await page.evaluate(
    ({ pId, n, cId }) => {
      window.gameState = {
        ...window.gameState,
        players: window.gameState.players.map((p) =>
          p.id === pId ? { ...p, shares: { ...p.shares, [cId]: n } } : p,
        ),
        bank: {
          ...window.gameState.bank,
          sharesRemaining: {
            ...window.gameState.bank.sharesRemaining,
            [cId]: window.gameState.bank.sharesRemaining[cId] - n,
          },
        },
      };
    },
    { pId: playerId, n: count, cId: corporationId },
  );
});

Given("{string}'s credits are noted", async ({ page }, playerId) => {
  const credits = await page.evaluate(
    (pId) => window.gameState.players.find((p) => p.id === pId).credits,
    playerId,
  );
  page.testState.creditsBefore[playerId] = credits;
});

// --- Actions (When) -----------------------------------------------------

When("{string} places sector {string}", async ({ page }, playerId, sectorId) => {
  await page.evaluate(
    ({ pId, sId }) => {
      window.gameState = window.CosmicModel.placeTile(window.gameState, pId, sId);
    },
    { pId: playerId, sId: sectorId },
  );
});

When("{string} founds {string}", async ({ page }, playerId, corporationId) => {
  await page.evaluate((cId) => {
    window.gameState = window.CosmicModel.foundCorporation(window.gameState, cId);
  }, corporationId);
});

When("{string} chooses {string} to survive the merger", async ({ page }, playerId, corporationId) => {
  await page.evaluate((cId) => {
    window.gameState = window.CosmicModel.chooseMergerSurvivor(window.gameState, cId);
  }, corporationId);
});

When(
  "{string} disposes of their shares in {string}: sell {int}, trade {int}, hold {int}",
  async ({ page }, playerId, corporationId, sell, trade, hold) => {
    await page.evaluate(
      ({ pId, cId, decision }) => {
        window.gameState = window.CosmicModel.decideShareDisposition(window.gameState, pId, cId, decision);
      },
      { pId: playerId, cId: corporationId, decision: { sell, trade, hold } },
    );
  },
);

When("{string} buys {int} shares of {string}", async ({ page }, playerId, quantity, corporationId) => {
  await page.evaluate(
    ({ pId, qty, cId }) => {
      window.gameState = window.CosmicModel.buyShares(window.gameState, pId, cId, qty);
    },
    { pId: playerId, qty: quantity, cId: corporationId },
  );
});

When("{string} attempts to buy {int} shares of {string}", async ({ page }, playerId, quantity, corporationId) => {
  await page.evaluate(
    ({ pId, qty, cId }) => {
      window.lastError = null;
      try {
        window.gameState = window.CosmicModel.buyShares(window.gameState, pId, cId, qty);
      } catch (error) {
        window.lastError = error.message;
      }
    },
    { pId: playerId, qty: quantity, cId: corporationId },
  );
});

When("{string} exchanges dead sector {string}", async ({ page }, playerId, sectorId) => {
  await page.evaluate(
    ({ pId, sId }) => {
      window.gameState = window.CosmicModel.exchangeDeadTile(window.gameState, pId, sId);
    },
    { pId: playerId, sId: sectorId },
  );
});

When("{string} ends the game", async ({ page }, playerId) => {
  await page.evaluate((pId) => {
    window.gameState = window.CosmicModel.endGame(window.gameState, pId);
  }, playerId);
});

// --- Assertions (Then) ---------------------------------------------------

Then("sector {string} is unincorporated", async ({ page }, sectorId) => {
  const corporationId = await page.evaluate(
    (sId) => window.gameState.board.get(sId)?.corporationId ?? null,
    sectorId,
  );
  expect(corporationId).toBeNull();
});

Then("the turn phase is {string}", async ({ page }, phase) => {
  const turnPhase = await page.evaluate(() => window.gameState.turnPhase);
  expect(turnPhase).toBe(phase);
});

Then("{string} has {int} sectors", async ({ page }, corporationId, count) => {
  const size = await page.evaluate((cId) => window.gameState.corporations[cId].sectors.size, corporationId);
  expect(size).toBe(count);
});

Then("{string} should hold {int} shares of {string}", async ({ page }, playerId, count, corporationId) => {
  const shares = await page.evaluate(
    ({ pId, cId }) => window.gameState.players.find((p) => p.id === pId).shares[cId] ?? 0,
    { pId: playerId, cId: corporationId },
  );
  expect(shares).toBe(count);
});

Then("{string}'s credits increased by {int}", async ({ page }, playerId, amount) => {
  const before = page.testState.creditsBefore[playerId];
  const after = await page.evaluate(
    (pId) => window.gameState.players.find((p) => p.id === pId).credits,
    playerId,
  );
  expect(after - before).toBe(amount);
});

Then("sector {string} is a dead tile", async ({ page }, sectorId) => {
  const dead = await page.evaluate((sId) => window.CosmicModel.isDeadTile(window.gameState, sId), sectorId);
  expect(dead).toBe(true);
});

Then("{string} does not hold sector {string}", async ({ page }, playerId, sectorId) => {
  const holdsIt = await page.evaluate(
    ({ pId, sId }) => window.gameState.players.find((p) => p.id === pId).hand.includes(sId),
    { pId: playerId, sId: sectorId },
  );
  expect(holdsIt).toBe(false);
});

Then("the attempt is rejected", async ({ page }) => {
  const error = await page.evaluate(() => window.lastError);
  expect(error).toBeTruthy();
});

Then("ending the game is available", async ({ page }) => {
  const available = await page.evaluate(() => window.CosmicModel.isEndGameAvailable(window.gameState));
  expect(available).toBe(true);
});
