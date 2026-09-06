// Corporation-specific helpers: creating the initial 7 corporations, and the
// derived properties (price, secure status, active/available) that
// docs/data-model.md says must be computed on demand rather than stored, so
// they can never drift out of sync with the actual sector count.

import { CORPORATIONS, SECURE_THRESHOLD, getSharePrice } from "./constants.js";

/**
 * Builds the initial corporations map (keyed by id) for a new game: all 7
 * corporations exist as entries from the start, each with zero sectors.
 * "Founding" a corporation (see game.js's foundCorporation()) doesn't create
 * a new entry — it just grows an existing one from 0 sectors to its first 2+.
 */
export function createInitialCorporations() {
  const corporations = {};
  for (const { id, name, tier } of CORPORATIONS) {
    corporations[id] = { id, name, tier, sectors: new Set() };
  }
  return corporations;
}

/** Current price per share, derived from tier + current sector count. */
export function getPrice(corporation) {
  return getSharePrice(corporation.tier, corporation.sectors.size);
}

/** True once a corporation has grown to 11+ sectors — safe from mergers. */
export function isSecure(corporation) {
  return corporation.sectors.size >= SECURE_THRESHOLD;
}

/** True if a corporation is on the board at all (has been founded). */
export function isActive(corporation) {
  return corporation.sectors.size > 0;
}

/**
 * True if a corporation's name is still free to be founded — the inverse of
 * isActive(). Used by placement.js to determine both whether founding is
 * possible at all (are there any available names left?) and, when a player
 * founds, which names they may choose among.
 */
export function isAvailable(corporation) {
  return corporation.sectors.size === 0;
}

/** All currently-founded corporations, from a corporations map. */
export function getActiveCorporations(corporations) {
  return Object.values(corporations).filter(isActive);
}

/** All not-yet-founded corporations, from a corporations map. */
export function getAvailableCorporations(corporations) {
  return Object.values(corporations).filter(isAvailable);
}

/**
 * Returns a new corporations map with the given corporation's sectors
 * replaced (a new Set, per the pure-function/immutability contract used
 * throughout js/model/ — see docs/game-engine-api.md). Callers pass the full
 * replacement Set rather than a single sector to add, since merger absorption
 * needs to move many sectors at once (see merger.js).
 */
export function setCorporationSectors(corporations, corporationId, sectors) {
  return {
    ...corporations,
    [corporationId]: { ...corporations[corporationId], sectors },
  };
}

/** Returns a new corporations map with one additional sector added. */
export function addSectorToCorporation(corporations, corporationId, sectorId) {
  const nextSectors = new Set(corporations[corporationId].sectors);
  nextSectors.add(sectorId);
  return setCorporationSectors(corporations, corporationId, nextSectors);
}
