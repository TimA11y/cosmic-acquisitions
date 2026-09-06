// Merger-specific logic: figuring out which corporation(s) are tied for
// largest (relevant when a player must choose the survivor), calculating
// majority/minority bonus payouts, building the queue of shareholder
// decisions a merger requires, and absorbing one corporation's sectors into
// another.

import { setSectorCorporation } from "./board.js";
import { setCorporationSectors } from "./corporations.js";
import { getShareCount } from "./players.js";
import {
  MAJORITY_BONUS_MULTIPLIER,
  MINORITY_BONUS_MULTIPLIER,
  BONUS_ROUNDING,
} from "./constants.js";

function roundUpToNearest(amount, unit) {
  return Math.ceil(amount / unit) * unit;
}

/**
 * Given a corporations map and a list of corporation ids involved in a
 * merger, returns the id(s) with the largest sector count. Returns more than
 * one id when there's a tie — that's exactly the situation where a player
 * must be asked to choose the survivor (docs/game-engine-api.md's
 * "choosingMergerSurvivor" phase); a single-element result means the
 * survivor is automatic.
 */
export function findLargestAmong(corporations, corporationIds) {
  const sizes = corporationIds.map((id) => corporations[id].sectors.size);
  const maxSize = Math.max(...sizes);
  return corporationIds.filter((id) => corporations[id].sectors.size === maxSize);
}

/**
 * Calculates majority/minority merger bonus payouts for one absorbed
 * corporation, following the original Acquire tie rules:
 *   - No shareholders at all: no payouts.
 *   - A single shareholder (of any count): they receive majority + minority
 *     combined — there's no one else to pay a minority bonus to.
 *   - A unique majority holder: they get the full majority bonus; if two or
 *     more players are tied for second place, they split the minority bonus
 *     evenly (rounded up to the nearest BONUS_ROUNDING).
 *   - Two or more players tied for the MOST shares: they split the majority
 *     AND minority bonuses combined, evenly, rounded up the same way — the
 *     original game's rule for a majority tie, which also means nobody else
 *     receives a minority payout.
 *
 * Takes `price` as an explicit parameter (rather than deriving it from a
 * live corporation object via corporations.js's getPrice()) because by the
 * time a merger's bonuses are paid, the absorbed corporation's sectors have
 * already moved to the survivor — its live size is 0. Callers must snapshot
 * the price at the moment the merger triggers (see game.js's
 * beginMergerResolution) and pass that snapshot in here.
 *
 * Returns a { [playerId]: creditsAwarded } map (players with no payout are
 * simply absent, not present with 0).
 */
export function calculateMergerBonuses(corporationId, price, players) {
  const majorityBonus = price * MAJORITY_BONUS_MULTIPLIER;
  const minorityBonus = price * MINORITY_BONUS_MULTIPLIER;

  const holders = players
    .map((player) => ({ playerId: player.id, count: getShareCount(player, corporationId) }))
    .filter((holder) => holder.count > 0)
    .sort((a, b) => b.count - a.count);

  if (holders.length === 0) {
    return {};
  }

  const payouts = {};
  const topCount = holders[0].count;
  const topHolders = holders.filter((holder) => holder.count === topCount);

  if (topHolders.length > 1) {
    // Majority tie: split both bonuses combined among the tied holders.
    const share = roundUpToNearest(
      (majorityBonus + minorityBonus) / topHolders.length,
      BONUS_ROUNDING,
    );
    for (const holder of topHolders) {
      payouts[holder.playerId] = share;
    }
    return payouts;
  }

  const [majorityHolder] = topHolders;
  payouts[majorityHolder.playerId] = majorityBonus;

  const remainingHolders = holders.filter((holder) => holder.playerId !== majorityHolder.playerId);
  if (remainingHolders.length === 0) {
    // Sole shareholder — no one else exists to receive the minority bonus.
    payouts[majorityHolder.playerId] += minorityBonus;
    return payouts;
  }

  const secondCount = remainingHolders[0].count;
  const minorityHolders = remainingHolders.filter((holder) => holder.count === secondCount);
  const minorityShare = roundUpToNearest(minorityBonus / minorityHolders.length, BONUS_ROUNDING);
  for (const holder of minorityHolders) {
    payouts[holder.playerId] = minorityShare;
  }

  return payouts;
}

/**
 * Builds the ordered queue of { playerId, corporationId } shareholder
 * decisions a merger requires. Two ordering rules, both matching the
 * original game:
 *   - Absorbed corporations are resolved largest-first, so bonuses and share
 *     dispositions for the biggest chain are settled before smaller ones.
 *   - Within one absorbed corporation, every OTHER player decides before the
 *     player whose placement triggered the merger — so the triggering
 *     player gets to see everyone else's decisions first, matching the
 *     original rule that the acting player resolves their own shares last.
 * Players holding zero shares in a given absorbed corporation are simply
 * skipped — there's nothing for them to decide.
 */
export function buildShareholderDecisionQueue(gameState, absorbedIds) {
  const { players, corporations, currentPlayerIndex } = gameState;

  const orderedAbsorbedIds = [...absorbedIds].sort(
    (a, b) => corporations[b].sectors.size - corporations[a].sectors.size,
  );

  const turnOrder = [
    ...players.slice(currentPlayerIndex + 1),
    ...players.slice(0, currentPlayerIndex + 1),
  ];

  const queue = [];
  for (const corporationId of orderedAbsorbedIds) {
    for (const player of turnOrder) {
      if (getShareCount(player, corporationId) > 0) {
        queue.push({ playerId: player.id, corporationId });
      }
    }
  }
  return queue;
}

/**
 * Absorbs one corporation's sectors into another: every board sector that
 * belonged to `absorbedId` is reassigned to `survivorId`, and `absorbedId`
 * is left with an empty sectors Set — which is exactly what corporations.js's
 * isAvailable() checks, so the absorbed name becomes foundable again
 * immediately, per docs/game-engine-api.md's decideShareDisposition() note.
 * Returns { board, corporations } rather than mutating either.
 */
export function absorbCorporation(board, corporations, survivorId, absorbedId) {
  const absorbedSectors = corporations[absorbedId].sectors;
  const survivorSectors = new Set(corporations[survivorId].sectors);

  let nextBoard = board;
  for (const sectorId of absorbedSectors) {
    survivorSectors.add(sectorId);
    nextBoard = setSectorCorporation(nextBoard, sectorId, survivorId);
  }

  let nextCorporations = setCorporationSectors(corporations, survivorId, survivorSectors);
  nextCorporations = setCorporationSectors(nextCorporations, absorbedId, new Set());

  return { board: nextBoard, corporations: nextCorporations };
}
