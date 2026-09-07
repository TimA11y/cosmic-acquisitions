// Dispatches to the right AI tier module by difficulty string. Every tier
// module exports the same function shapes (choosePlacementAction,
// chooseCorporationToFound, chooseMergerSurvivor, decideDisposition,
// chooseShareBuy) — see js/ai/easy.js, medium.js, and hard.js — so
// js/ui/main.js can call through this without knowing which tier it's
// actually talking to. Note that hard's choosePlacementAction is async
// (it runs a time-boxed search); callers should always `await` it, which
// is a harmless no-op for the other tiers' synchronous implementations.

import * as easy from "./easy.js";
import * as medium from "./medium.js";
import * as hard from "./hard.js";

const STRATEGIES = { easy, medium, hard };

/**
 * Falls back to easy for any difficulty without a real strategy (today:
 * anything resumed from a save whose aiDifficulties entry is missing,
 * since that map isn't part of the saved gameState).
 */
export function getAiStrategy(difficulty) {
  return STRATEGIES[difficulty] ?? easy;
}
