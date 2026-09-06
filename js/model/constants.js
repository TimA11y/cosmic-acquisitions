// Fixed rules data for Cosmic Acquisitions. Nothing in this file depends on
// game state — it's the numbers and names the rest of js/model/ looks up.
// See docs/file-layout.md: constants.js sits at the bottom of the dependency
// graph, so everything else in js/model/ can safely import from here.

// The 7 corporations, from requirements.md's "Space theme glossary." Kept
// intentionally distinct-first-letter (N, K, O, H, V, T, Z) so players —
// especially screen reader users navigating by first letter — can tell them
// apart instantly, per the note in requirements.md.
export const CORPORATIONS = [
  { id: "novaTraders", name: "Nova Traders", tier: "economy" },
  { id: "kestrelMining", name: "Kestrel Mining", tier: "economy" },
  { id: "orionFreight", name: "Orion Freight", tier: "standard" },
  { id: "heliosEnergy", name: "Helios Energy", tier: "standard" },
  { id: "vanguardDynamics", name: "Vanguard Dynamics", tier: "standard" },
  { id: "titanIndustries", name: "Titan Industries", tier: "luxury" },
  { id: "zenithConsortium", name: "Zenith Consortium", tier: "luxury" },
];

// Board dimensions: 12 columns (1-12) x 9 rows (A-I), same grid as the
// original Acquire board. Sector ids look like "6-B" (see board.js).
export const BOARD_COLUMNS = 12;
export const BOARD_ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

// Core numeric rules, unchanged from base Acquire (requirements.md: "the
// mechanics are unchanged from base Acquire ... only terminology changes").
export const STARTING_CREDITS = 6000;
export const HAND_SIZE = 6;
export const SHARE_CAP = 25; // total shares the bank holds per corporation
export const SECURE_THRESHOLD = 11; // sectors at/above this size can't be merger targets
export const ENDGAME_THRESHOLD = 41; // sectors at/above this size makes ending the game available
export const MAX_SHARES_PURCHASED_PER_TURN = 3;

// --- Price chart -----------------------------------------------------------
//
// Reconstructed from the original Acquire price chart (a fixed, published
// table, not something we're inventing): price per share depends on a
// corporation's *tier* and its current *sector count*, grouped into ten
// size brackets. Within a bracket, luxury costs 200 more than economy and
// standard sits exactly in between; each bracket step adds another 100
// across all three tiers. This is what docs/data-model.md means by
// "derived ... via lookup against the price chart."
//
// Size bracket upper bounds (10 brackets: 2,3,4,5,6,7-10,11-20,21-30,31-40,41+).
// A size s falls in bracket i = index of the first entry >= s.
const PRICE_BRACKET_MAX_SIZE = [2, 3, 4, 5, 6, 10, 20, 30, 40, Infinity];

// Base price (bracket 0, i.e. size 2) per tier; each subsequent bracket
// adds PRICE_BRACKET_STEP.
const TIER_BASE_PRICE = { economy: 200, standard: 300, luxury: 400 };
const PRICE_BRACKET_STEP = 100;

/**
 * Index into PRICE_BRACKET_MAX_SIZE for a given sector count. Sizes below 2
 * aren't meaningful (a corporation doesn't exist below 2 sectors — founding
 * requires connecting two tiles), but we clamp defensively rather than throw,
 * since callers may probe hypothetical sizes (e.g. AI lookahead).
 */
function getPriceBracketIndex(sectorCount) {
  const size = Math.max(sectorCount, 2);
  return PRICE_BRACKET_MAX_SIZE.findIndex((maxSize) => size <= maxSize);
}

/**
 * Price per share for a corporation of the given tier at the given sector
 * count. This is the single source of truth other files should call through
 * (see corporations.js's getPrice()) rather than re-deriving bracket math.
 */
export function getSharePrice(tier, sectorCount) {
  const bracketIndex = getPriceBracketIndex(sectorCount);
  return TIER_BASE_PRICE[tier] + bracketIndex * PRICE_BRACKET_STEP;
}

// Merger bonuses: majority holder gets 10x the current share price, minority
// holder gets 5x — the classic Acquire split (informally "60/30" in
// requirements.md, referring to the roughly 2:1 ratio between the two
// payouts). Both are rounded up to the nearest 100 when split among tied
// holders (see merger.js).
export const MAJORITY_BONUS_MULTIPLIER = 10;
export const MINORITY_BONUS_MULTIPLIER = 5;
export const BONUS_ROUNDING = 100;
