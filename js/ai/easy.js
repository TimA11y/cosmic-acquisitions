// Easy-tier AI: uniformly random legal moves, per docs/ai-design.md. Every
// function here is decision-only — it inspects a getViewFor() view (never
// the raw gameState, per docs/data-model.md's "Public vs. private
// information" rule, applied symmetrically to AI as well as the human UI)
// and returns a plain description of a choice. js/ui/main.js is responsible
// for feeding that choice into the real js/model/ mutation functions.

import {
  getLegalPlacements,
  isDeadTile,
  getAvailableCorporations,
  getPrice,
  isActive,
  MAX_SHARES_PURCHASED_PER_TURN,
} from "../model/index.js";

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Decides what to do with the acting player's hand this turn: place a
 * random legal sector, or — in the edge case where every hand tile is
 * simultaneously dead — exchange one instead (docs/game-engine-api.md's
 * "prove it's dead, discard, redraw" rule).
 */
export function choosePlacementAction(view, playerId) {
  const legalPlacements = getLegalPlacements(view, playerId);
  if (legalPlacements.length > 0) {
    return { action: "place", sectorId: randomItem(legalPlacements) };
  }
  const player = view.players.find((p) => p.id === playerId);
  const deadSectorId = player.hand.find((sectorId) => isDeadTile(view, sectorId));
  return { action: "exchange", sectorId: deadSectorId };
}

/**
 * Uniformly random pick among corporation names still available to found.
 * Every AI tier exposes this same (view, playerId) shape — see
 * js/ai/index.js's getAiStrategy() — even though easy has no use for
 * playerId here.
 */
export function chooseCorporationToFound(view, playerId) {
  return randomItem(getAvailableCorporations(view.corporations)).id;
}

/** Uniformly random pick among the corporations tied for largest in a merger. */
export function chooseMergerSurvivor(view, playerId) {
  return randomItem(view.pendingMerger.candidateSurvivorIds);
}

/**
 * The easy tier's fixed rule for merger share disposition: sell the entire
 * holding rather than trade or hold ("No judgment needed at this tier" per
 * docs/ai-design.md). Takes the same (view, playerId, corporationId,
 * shareCount) shape as every tier's decideDisposition, even though easy
 * only needs shareCount — medium's version needs the rest to weigh
 * trading against selling.
 */
export function decideDisposition(view, playerId, corporationId, shareCount) {
  return { sell: shareCount, trade: 0, hold: 0 };
}

/**
 * Randomly decides whether to buy shares this turn, restricted to
 * corporations the AI can afford at least one share of and the bank still
 * has available. Deliberately doesn't always spend up to the cap — "buy 0-3
 * shares" per docs/ai-design.md means sometimes buying nothing at all, not
 * maxing out every turn. Buys from a single corporation per turn; a real
 * medium/hard tier might split across several, but that's beyond what this
 * stub needs.
 */
export function chooseShareBuy(view, playerId) {
  const player = view.players.find((p) => p.id === playerId);
  const remainingAllowance = MAX_SHARES_PURCHASED_PER_TURN - view.sharesPurchasedThisTurn;
  if (remainingAllowance <= 0) return null;

  const candidates = Object.values(view.corporations).filter(
    (corporation) => isActive(corporation) && view.bank.sharesRemaining[corporation.id] > 0,
  );
  if (candidates.length === 0) return null;

  const corporation = randomItem(candidates);
  const price = getPrice(corporation);
  const maxAffordable = Math.floor(player.credits / price);
  const maxPurchasable = Math.min(
    remainingAllowance,
    maxAffordable,
    view.bank.sharesRemaining[corporation.id],
  );
  if (maxPurchasable <= 0) return null;

  // Half the time, skip buying entirely even when it's affordable.
  if (Math.random() < 0.5) return null;

  const quantity = 1 + Math.floor(Math.random() * maxPurchasable);
  return { corporationId: corporation.id, quantity };
}
