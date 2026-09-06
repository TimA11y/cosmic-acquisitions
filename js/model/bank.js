// The bank: the shared sector pool (draw pile) and each corporation's
// remaining share supply. Like every other file in js/model/, functions here
// return new state rather than mutating what's passed in.

import { CORPORATIONS, SHARE_CAP } from "./constants.js";
import { getAllSectorIds } from "./board.js";

/**
 * Fisher-Yates shuffle. Used once, at game start, to randomize the sector
 * pool's draw order. Unlike the rest of js/model/'s functions this is
 * intentionally non-deterministic (relies on Math.random) — it models
 * physically shuffling tiles, not a rules transition that needs to be
 * replay-safe.
 */
function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Creates a new bank for the start of a game: every one of the 108 sectors
 * shuffled into the draw pool, and a full SHARE_CAP (25) shares available
 * per corporation — including the two not-yet-founded corporations, since
 * shares only become purchasable once a corporation is founded, not before.
 */
export function createBank() {
  const sharesRemaining = {};
  for (const { id } of CORPORATIONS) {
    sharesRemaining[id] = SHARE_CAP;
  }
  return {
    sectorPool: shuffle(getAllSectorIds()),
    sharesRemaining,
  };
}

/**
 * Draws the next sector from the pool. Returns { bank, sectorId }, with
 * sectorId === null and bank unchanged if the pool is empty — callers (e.g.
 * drawTile() in game.js, refilling a hand) check for null rather than the
 * function throwing, since "the pool ran dry" is an expected end-of-game
 * condition, not an error.
 */
export function drawFromPool(bank) {
  if (bank.sectorPool.length === 0) {
    return { bank, sectorId: null };
  }
  const [sectorId, ...remainingPool] = bank.sectorPool;
  return { bank: { ...bank, sectorPool: remainingPool }, sectorId };
}

/**
 * Returns a new bank with `quantity` fewer shares available for one
 * corporation — used both when a player buys shares and when a founder
 * receives their free share. Callers (game.js) are responsible for checking
 * availability first via sharesRemaining; this function doesn't clamp at
 * zero itself, since a negative count would indicate a caller bug that's
 * better surfaced than silently hidden.
 */
export function removeSharesFromBank(bank, corporationId, quantity) {
  return {
    ...bank,
    sharesRemaining: {
      ...bank.sharesRemaining,
      [corporationId]: bank.sharesRemaining[corporationId] - quantity,
    },
  };
}

/**
 * Returns a new bank with `quantity` more shares available for one
 * corporation. Not exercised by the normal turn flow (shares that leave the
 * bank stay in player hands until the game ends), but kept symmetric with
 * removeSharesFromBank for the same reason players.js keeps adjustShares
 * bidirectional — one function to reason about instead of two that could
 * drift apart.
 */
export function addSharesToBank(bank, corporationId, quantity) {
  return removeSharesFromBank(bank, corporationId, -quantity);
}
