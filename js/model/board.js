// Low-level Star Map (board) operations: sector id parsing/formatting,
// reading/writing the board Map, and adjacency lookup. Everything else that
// needs to reason about the board (placement.js, merger.js) builds on this
// rather than re-parsing sector ids itself, so the "6-B" string format is
// only understood in one place.

import { BOARD_COLUMNS, BOARD_ROWS } from "./constants.js";

/**
 * Splits a sector id like "6-B" into its column (a 1-based number) and row
 * (a single letter). Kept as a plain object rather than a class/tuple since
 * this whole codebase avoids classes in favor of plain data (see
 * docs/data-model.md's "no classes" note).
 */
export function parseSectorId(sectorId) {
  const [colPart, row] = sectorId.split("-");
  return { col: Number(colPart), row };
}

/** Inverse of parseSectorId: builds the "6-B" string from column + row. */
export function formatSectorId(col, row) {
  return `${col}-${row}`;
}

/**
 * An empty board is just an empty Map — sectors that haven't been placed yet
 * simply have no entry (see docs/data-model.md), rather than an explicit
 * "empty" marker for all 108 sectors up front.
 */
export function createEmptyBoard() {
  return new Map();
}

/**
 * Reads a sector's state, or undefined if nothing has been placed there yet.
 * Returning undefined (not null) for "not placed" mirrors Map.get()'s own
 * convention, so callers can use the same falsy check either way.
 */
export function getSector(board, sectorId) {
  return board.get(sectorId);
}

/**
 * Places a sector on the board, optionally already assigned to a
 * corporation. Returns a NEW Map rather than mutating the one passed in —
 * every function in js/model/ follows this pure-function contract (see
 * docs/game-engine-api.md) so callers can rely on the input state staying
 * untouched.
 */
export function placeSectorOnBoard(board, sectorId, corporationId = null) {
  const nextBoard = new Map(board);
  nextBoard.set(sectorId, { corporationId });
  return nextBoard;
}

/**
 * Returns a new board with the given sector reassigned to a different
 * corporation (or back to unincorporated with null) — used when a merger
 * absorbs one corporation's sectors into the survivor.
 */
export function setSectorCorporation(board, sectorId, corporationId) {
  return placeSectorOnBoard(board, sectorId, corporationId);
}

/**
 * All 108 sector ids on the grid, in column-major, then row order
 * (1-A, 1-B, ... 1-I, 2-A, ...). Used to build the bank's initial sector
 * pool (see bank.js) — this is the full universe of sectors that will ever
 * exist, independent of what's currently on the board.
 */
export function getAllSectorIds() {
  const ids = [];
  for (let col = 1; col <= BOARD_COLUMNS; col += 1) {
    for (const row of BOARD_ROWS) {
      ids.push(formatSectorId(col, row));
    }
  }
  return ids;
}

/**
 * Orthogonal (up/down/left/right, no diagonals) neighboring sector ids that
 * actually exist on the grid — this is what "adjacency" means for founding,
 * growing, and merging corporations throughout the rules engine. Diagonal
 * tiles are never adjacent in Acquire, so this is deliberately a 4-direction
 * lookup, not 8.
 */
export function getNeighbors(sectorId) {
  const { col, row } = parseSectorId(sectorId);
  const rowIndex = BOARD_ROWS.indexOf(row);
  const neighbors = [];

  if (col > 1) neighbors.push(formatSectorId(col - 1, row));
  if (col < BOARD_COLUMNS) neighbors.push(formatSectorId(col + 1, row));
  if (rowIndex > 0) neighbors.push(formatSectorId(col, BOARD_ROWS[rowIndex - 1]));
  if (rowIndex < BOARD_ROWS.length - 1) {
    neighbors.push(formatSectorId(col, BOARD_ROWS[rowIndex + 1]));
  }

  return neighbors;
}
