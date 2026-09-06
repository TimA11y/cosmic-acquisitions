// Placement legality and outcome analysis: figuring out what would happen if
// a given sector were placed, without actually placing it. This is the
// single source of truth both the UI (to preview a placement and to grey out
// dead tiles) and the AI (to enumerate legal moves) read from, per
// docs/game-engine-api.md's note that getLegalPlacements/isDeadTile must
// never let the two disagree.

import { getSector, getNeighbors } from "./board.js";
import { isSecure, getAvailableCorporations } from "./corporations.js";

/**
 * Flood-fills outward from `startSectorId` through sectors that are either
 * the starting sector itself (which isn't on the board yet) or already
 * placed-but-unincorporated neighbors (corporationId === null). This finds
 * every "lone tile" that would get swept up together by a single placement —
 * needed for both founding (the whole connected group becomes the new
 * corporation) and growing (loose neighboring tiles join the existing
 * corporation along with the new one).
 */
function findConnectedUnincorporatedGroup(board, startSectorId) {
  const visited = new Set([startSectorId]);
  const queue = [startSectorId];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const neighborId of getNeighbors(current)) {
      if (visited.has(neighborId)) continue;
      const neighborSector = getSector(board, neighborId);
      // Only cross into neighbors that are placed AND unincorporated. A
      // neighbor that isn't placed at all is just empty space (not part of
      // this group); a neighbor that belongs to a corporation is a boundary,
      // not something this flood-fill should swallow.
      if (neighborSector !== undefined && neighborSector.corporationId === null) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  return [...visited];
}

/**
 * Describes what placing `sectorId` would do, without applying it. Returns
 * one of:
 *   { effect: "none" }
 *   { effect: "found", sectors: [...] }               — sectors is the full
 *       connected group (including sectorId) that would become the new
 *       corporation once a name is chosen.
 *   { effect: "grow", corporationId, sectors: [...] } — sectors is
 *       sectorId plus any loose unincorporated neighbors also being absorbed.
 *   { effect: "merger", corporationIds: [...] }       — 2+ distinct
 *       corporations that would be merged together.
 */
export function analyzePlacement(gameState, sectorId) {
  const { board } = gameState;
  const placedNeighbors = getNeighbors(sectorId).filter(
    (id) => getSector(board, id) !== undefined,
  );

  if (placedNeighbors.length === 0) {
    return { effect: "none" };
  }

  const adjacentCorporationIds = [
    ...new Set(
      placedNeighbors
        .map((id) => getSector(board, id).corporationId)
        .filter((corporationId) => corporationId !== null),
    ),
  ];

  if (adjacentCorporationIds.length === 0) {
    // Every placed neighbor is a lone, unincorporated tile — this placement
    // founds a brand-new corporation out of the whole connected group.
    return { effect: "found", sectors: findConnectedUnincorporatedGroup(board, sectorId) };
  }

  if (adjacentCorporationIds.length === 1) {
    const [corporationId] = adjacentCorporationIds;
    // Growing a corporation can also sweep in any loose unincorporated tiles
    // connected through this placement, not just the one new sector.
    return {
      effect: "grow",
      corporationId,
      sectors: findConnectedUnincorporatedGroup(board, sectorId),
    };
  }

  return { effect: "merger", corporationIds: adjacentCorporationIds };
}

/**
 * True if placing this sector would be illegal right now: either it would
 * force a merger between two or more corporations that are all already
 * secure (11+ sectors — mergers among multiple safe corporations are
 * forbidden by the rules), or it would found a new corporation but all 7
 * corporation names are already active on the board.
 */
export function isDeadTile(gameState, sectorId) {
  const analysis = analyzePlacement(gameState, sectorId);

  if (analysis.effect === "merger") {
    const secureCount = analysis.corporationIds.filter((id) =>
      isSecure(gameState.corporations[id]),
    ).length;
    return secureCount >= 2;
  }

  if (analysis.effect === "found") {
    return getAvailableCorporations(gameState.corporations).length === 0;
  }

  return false;
}

/**
 * Sector ids from a player's hand that are legal to place right now. This is
 * the ONLY place "what's legal" is decided — the UI greys out/skips dead
 * tiles by calling this, and the AI enumerates its options the same way, so
 * the two can never disagree (see docs/game-engine-api.md).
 */
export function getLegalPlacements(gameState, playerId) {
  const player = gameState.players.find((p) => p.id === playerId);
  return player.hand.filter((sectorId) => !isDeadTile(gameState, sectorId));
}
