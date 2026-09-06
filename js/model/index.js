// Public entry point for js/model/. Per docs/file-layout.md, nothing outside
// js/model/ should import from the individual concern files directly — this
// is the one clean import path js/ui/ and js/ai/ code should use, so the
// internal file split stays free to change without breaking either of them.

export {
  createGame,
  placeTile,
  foundCorporation,
  chooseMergerSurvivor,
  decideShareDisposition,
  buyShares,
  drawTile,
  exchangeDeadTile,
  endGame,
  isEndGameAvailable,
  getViewFor,
  analyzePlacement,
  isDeadTile,
  getLegalPlacements,
} from "./game.js";

export { serialize, deserialize } from "./persistence.js";

export { parseSectorId, formatSectorId, getAllSectorIds, getNeighbors } from "./board.js";

export {
  getPrice,
  isSecure,
  isActive,
  isAvailable,
  getActiveCorporations,
  getAvailableCorporations,
} from "./corporations.js";

export {
  CORPORATIONS,
  BOARD_COLUMNS,
  BOARD_ROWS,
  STARTING_CREDITS,
  HAND_SIZE,
  SHARE_CAP,
  SECURE_THRESHOLD,
  ENDGAME_THRESHOLD,
  MAX_SHARES_PURCHASED_PER_TURN,
} from "./constants.js";
