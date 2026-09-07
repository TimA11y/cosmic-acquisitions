// Dispatches to the right AI tier module by difficulty string. Every tier
// module exports the same function shapes (choosePlacementAction,
// chooseCorporationToFound, chooseMergerSurvivor, decideDisposition,
// chooseShareBuy) — see js/ai/easy.js and js/ai/medium.js — so
// js/ui/main.js can call through this without knowing which tier it's
// actually talking to.

import * as easy from "./easy.js";
import * as medium from "./medium.js";

const STRATEGIES = { easy, medium };

/**
 * Falls back to easy for any difficulty without a real strategy yet
 * (today: "hard", per docs/ai-design.md — not built — and any resumed
 * save whose aiDifficulties entry is missing, since that map isn't part of
 * the saved gameState).
 */
export function getAiStrategy(difficulty) {
  return STRATEGIES[difficulty] ?? easy;
}
