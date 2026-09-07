// Medium-tier AI: one-ply heuristic scoring, per docs/ai-design.md. Same
// decision-only contract as js/ai/easy.js (a getViewFor() view in, a plain
// choice out — never mutates state itself, per docs/data-model.md's
// privacy rule applied symmetrically to AI), and the same tier-agnostic
// function shapes dispatched by js/ai/index.js's getAiStrategy(). The exact
// weights below are the "empirical tuning" docs/ai-design.md explicitly
// left open for implementation time — chosen to be directionally right
// (grow > isolated, founding is strong, consolidate existing positions)
// rather than precisely tuned against real play data.
//
// Every scoring function here can only see the acting AI's OWN shares —
// getViewFor() strips every other player's holdings down to handSize, so
// docs/ai-design.md's "avoid mergers that mainly benefit the human" can
// only be approximated as "favor moves that build my own position"; there
// is no information available to do better than that, by design.

import {
  getLegalPlacements,
  isDeadTile,
  analyzePlacement,
  getAvailableCorporations,
  getPrice,
  isActive,
  isSecure,
  SECURE_THRESHOLD,
  MAX_SHARES_PURCHASED_PER_TURN,
} from "../model/index.js";

const TIER_RANK = { luxury: 3, standard: 2, economy: 1 };

function getOwnShareCount(view, playerId, corporationId) {
  const player = view.players.find((p) => p.id === playerId);
  return player.shares[corporationId] ?? 0;
}

/**
 * Scores one legal placement against docs/ai-design.md's four criteria:
 * founding (a near-sure free share), growing a corporation the AI already
 * holds (weighted by how much it holds, with an extra bump for newly
 * reaching secure), and a merger's potential payout (approximated by
 * summed ownership across the involved corporations).
 */
function scorePlacement(view, playerId, sectorId) {
  const analysis = analyzePlacement(view, sectorId);

  switch (analysis.effect) {
    case "found":
      return 5;

    case "grow": {
      const corporation = view.corporations[analysis.corporationId];
      const ownShares = getOwnShareCount(view, playerId, analysis.corporationId);
      const sizeAfter = corporation.sectors.size + analysis.sectors.length;
      const newlySecure = !isSecure(corporation) && sizeAfter >= SECURE_THRESHOLD;
      return 2 + ownShares * 1.5 + (newlySecure ? 2 + ownShares : 0);
    }

    case "merger":
      return analysis.corporationIds.reduce(
        (total, corporationId) => total + getOwnShareCount(view, playerId, corporationId) * 1.5,
        1, // a merger is at least mildly interesting even with no stake in it
      );

    default: // "none"
      return 1;
  }
}

/**
 * Picks the highest-scoring legal placement. Falls back to exchanging a
 * dead tile, same as easy, in the edge case where the whole hand is dead at
 * once.
 */
export function choosePlacementAction(view, playerId) {
  const legalPlacements = getLegalPlacements(view, playerId);
  if (legalPlacements.length > 0) {
    const bestSectorId = legalPlacements.reduce((best, sectorId) =>
      scorePlacement(view, playerId, sectorId) > scorePlacement(view, playerId, best) ? sectorId : best,
    );
    return { action: "place", sectorId: bestSectorId };
  }
  const player = view.players.find((p) => p.id === playerId);
  const deadSectorId = player.hand.find((sectorId) => isDeadTile(view, sectorId));
  return { action: "exchange", sectorId: deadSectorId };
}

/**
 * Prefers the highest-tier available name — a founder's free share is worth
 * more later in a pricier tier.
 */
export function chooseCorporationToFound(view, playerId) {
  const available = getAvailableCorporations(view.corporations);
  return available.reduce((best, corporation) =>
    TIER_RANK[corporation.tier] > TIER_RANK[best.tier] ? corporation : best,
  ).id;
}

/** Prefers the tied candidate the AI already holds the most shares in. */
export function chooseMergerSurvivor(view, playerId) {
  const { candidateSurvivorIds } = view.pendingMerger;
  return candidateSurvivorIds.reduce((best, corporationId) =>
    getOwnShareCount(view, playerId, corporationId) > getOwnShareCount(view, playerId, best)
      ? corporationId
      : best,
  );
}

/**
 * Trades into the surviving corporation when it's fully possible (the bank
 * has enough shares left for an even split) and the survivor looks like a
 * good hold (already secure, or bigger than the corp being absorbed),
 * selling any odd remainder. Otherwise falls back to selling everything,
 * same as easy — the point is showing *some* judgment where easy has none
 * ("No judgment needed at this tier" per docs/ai-design.md), not landing on
 * a maximally clever trading strategy.
 */
export function decideDisposition(view, playerId, corporationId, shareCount) {
  const survivor = view.corporations[view.pendingMerger.survivorId];
  const absorbed = view.corporations[corporationId];
  const survivorLooksGood = isSecure(survivor) || survivor.sectors.size > absorbed.sectors.size;

  const maxTradePairs = Math.floor(shareCount / 2);
  const availableSurvivorShares = view.bank.sharesRemaining[survivor.id];
  const canFullyTrade = survivorLooksGood && maxTradePairs > 0 && availableSurvivorShares >= maxTradePairs;

  if (!canFullyTrade) {
    return { sell: shareCount, trade: 0, hold: 0 };
  }

  const trade = maxTradePairs * 2;
  return { sell: shareCount - trade, trade, hold: 0 };
}

/**
 * Buys into the highest-scoring affordable active corporation — own
 * existing share count plus a flat bonus for already being secure — up to
 * whatever's affordable/allowed. Unlike easy, never randomly skips: a
 * deliberate tier buys whenever there's a reasonable candidate.
 */
export function chooseShareBuy(view, playerId) {
  const player = view.players.find((p) => p.id === playerId);
  const remainingAllowance = MAX_SHARES_PURCHASED_PER_TURN - view.sharesPurchasedThisTurn;
  if (remainingAllowance <= 0) return null;

  const candidates = Object.values(view.corporations).filter(
    (corporation) =>
      isActive(corporation) &&
      view.bank.sharesRemaining[corporation.id] > 0 &&
      getPrice(corporation) <= player.credits,
  );
  if (candidates.length === 0) return null;

  const scoreCorporation = (corporation) =>
    getOwnShareCount(view, playerId, corporation.id) * 2 + (isSecure(corporation) ? 3 : 0);
  const best = candidates.reduce((top, corporation) =>
    scoreCorporation(corporation) > scoreCorporation(top) ? corporation : top,
  );

  const price = getPrice(best);
  const quantity = Math.min(
    remainingAllowance,
    Math.floor(player.credits / price),
    view.bank.sharesRemaining[best.id],
  );
  return quantity > 0 ? { corporationId: best.id, quantity } : null;
}
