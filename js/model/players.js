// Player creation and immutable hand/shares/credits manipulation. Every
// function returns a new player object rather than mutating the one passed
// in, matching the pure-function contract the whole rules engine follows
// (see docs/game-engine-api.md) so game.js can freely pass players around
// without worrying about aliasing.

import { STARTING_CREDITS } from "./constants.js";

/**
 * Creates a new player at the start of a game. `hand` starts empty here —
 * the initial deal (drawing up to HAND_SIZE) is bank.js/game.js's job, once
 * a bank with a shuffled sector pool exists, not something a bare player
 * object should assume.
 */
export function createPlayer(id, name, isHuman) {
  return {
    id,
    name,
    isHuman,
    hand: [], // PRIVATE: sector ids currently held
    shares: {}, // PRIVATE: count per corporation id; omitted keys mean 0
    credits: STARTING_CREDITS, // PRIVATE
  };
}

/** Returns a new player with a sector id appended to their hand. */
export function addToHand(player, sectorId) {
  return { ...player, hand: [...player.hand, sectorId] };
}

/**
 * Returns a new player with the given sector id removed from their hand.
 * Removing by value (not index) since the UI/AI both reason about hands in
 * terms of sector ids, never positions.
 */
export function removeFromHand(player, sectorId) {
  return { ...player, hand: player.hand.filter((id) => id !== sectorId) };
}

/** Current share count a player holds in one corporation (0 if none). */
export function getShareCount(player, corporationId) {
  return player.shares[corporationId] ?? 0;
}

/**
 * Returns a new player with `delta` shares of one corporation added (delta
 * may be negative to remove shares — decideShareDisposition's "sell" and
 * "trade" cases both reduce a holding, so one function covers both
 * directions rather than having separate add/remove functions drift apart).
 */
export function adjustShares(player, corporationId, delta) {
  const nextCount = getShareCount(player, corporationId) + delta;
  return {
    ...player,
    shares: { ...player.shares, [corporationId]: nextCount },
  };
}

/** Returns a new player with `delta` credits added (delta may be negative). */
export function adjustCredits(player, delta) {
  return { ...player, credits: player.credits + delta };
}
