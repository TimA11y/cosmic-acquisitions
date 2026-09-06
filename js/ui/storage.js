// Thin localStorage wrapper for save/resume (docs/persistence-design.md).
// Every function here degrades gracefully on failure — a quota error, a
// disabled/unavailable localStorage (some private-browsing modes), a
// corrupted save, or an incompatible schemaVersion (see
// js/model/persistence.js) all just mean "there's no usable save", not a
// crash. Saving is a convenience layered on top of gameplay, never
// something gameplay depends on.

import { serialize, deserialize } from "../model/index.js";

const STORAGE_KEY = "cosmic-acquisitions-save";

/** Returns the saved gameState, or null if there isn't a usable one. */
export function loadSavedGame() {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return deserialize(json);
  } catch (error) {
    console.warn("Could not load saved game:", error);
    return null;
  }
}

/** Best-effort save — silently does nothing if localStorage is unavailable. */
export function saveGame(gameState) {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(gameState));
  } catch (error) {
    console.warn("Could not save game:", error);
  }
}

/** Best-effort clear — called on "New Game" and once a game finishes. */
export function clearSavedGame() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear saved game:", error);
  }
}
