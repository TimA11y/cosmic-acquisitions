// Hard-tier AI: determinized Monte Carlo Tree Search, per docs/ai-design.md.
// Same decision-only contract as every tier (a getViewFor() view in, a
// choice out) — but choosePlacementAction() here is async, since it runs a
// time-boxed search that periodically yields to the browser rather than
// computing its answer in one synchronous pass. Every other decision
// (founding, merger-survivor ties, share disposition, share buying) is
// re-exported from js/ai/medium.js unchanged — hard's distinguishing
// feature is deep search on the placement decision specifically, not a
// bespoke simulation-based strategy for every decision type. Real MCTS
// implementations commonly make the same call: tree-search the decision
// that matters most, use a fast heuristic/random policy elsewhere.
//
// Root-level UCB1 + light-playout simplification: this does NOT build a
// full multi-ply tree covering every rules branch (founding choices, merger
// ties, share purchases, at every future decision point, for every player)
// — that would be intractable given this game's branching factor. Instead
// it tree-searches only the ROOT placement decision via UCB1, then plays
// each simulated line forward with fast, uniformly-random moves (the same
// fixed rules js/ai/easy.js uses) for a bounded number of further turns,
// and evaluates the resulting state. This is a standard, tractable MCTS
// simplification, not a shortcut around the docs' intent.

import {
  getLegalPlacements,
  isDeadTile,
  getAllSectorIds,
  placeTile,
  foundCorporation,
  chooseMergerSurvivor as applyMergerSurvivor,
  decideShareDisposition,
  drawTile,
  getAvailableCorporations,
  getPrice,
  STARTING_CREDITS,
} from "../model/index.js";

export { chooseCorporationToFound, chooseMergerSurvivor, decideDisposition, chooseShareBuy } from "./medium.js";

// A fixed wall-clock budget (not a fixed simulation count) so this adapts to
// whatever hardware it runs on, resolving docs/ai-design.md's "simulation
// count/time budget" open question without hand-picking a number that could
// be wildly wrong on a slower machine.
const TOTAL_TIME_BUDGET_MS = 400;
const DETERMINIZATION_COUNT = 5;
const ROLLOUTS_PER_YIELD = 8;
const MAX_ROLLOUT_PLIES = 6;
const UCB1_EXPLORATION_CONSTANT = Math.SQRT2;

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Builds a fully-known-information gameState consistent with everything
 * public. The AI's own hand stays real; every other player's `shares`/
 * `credits` are ALSO already exactly known (see docs/data-model.md's
 * revised public/private split) — only hand CONTENTS need sampling. Deals
 * the "unseen" sectors (everything not on the board or in the AI's hand)
 * to opponents' hands (matching their real, public handSize) and the bank's
 * sector pool, then hands back a real gameState shape that the actual pure
 * engine functions can run on directly — the payoff of the engine being
 * built as pure functions in the first place (docs/ai-design.md).
 */
function determinizeHiddenState(view, aiPlayerId) {
  const aiPlayer = view.players.find((p) => p.id === aiPlayerId);
  const knownSectorIds = new Set([...view.board.keys(), ...aiPlayer.hand]);
  const unseenSectorIds = shuffle(getAllSectorIds().filter((id) => !knownSectorIds.has(id)));

  let cursor = 0;
  const players = view.players.map((player) => {
    if (player.id === aiPlayerId) return player;
    const hand = unseenSectorIds.slice(cursor, cursor + player.handSize);
    cursor += player.handSize;
    return { ...player, hand };
  });

  const sectorPool = unseenSectorIds.slice(cursor);
  const { sectorPoolSize, ...bankWithoutSize } = view.bank;
  return { ...view, players, bank: { ...bankWithoutSize, sectorPool } };
}

/** credits + Σ(shares × price), normalized by STARTING_CREDITS so UCB1's
 * exploration term (typically O(1)) is on a comparable scale to value
 * differences — raw credit values (thousands) would swamp it otherwise. */
function evaluateState(state, aiPlayerId) {
  const player = state.players.find((p) => p.id === aiPlayerId);
  const shareValue = Object.entries(player.shares).reduce((total, [corporationId, count]) => {
    if (count <= 0) return total;
    return total + count * getPrice(state.corporations[corporationId]);
  }, 0);
  return (player.credits + shareValue) / STARTING_CREDITS;
}

/**
 * Resolves one full player turn from a chosen placement: places the tile,
 * auto-resolves founding/merger-survivor/disposition with simple fixed
 * rules (random choice, sell everything — the same rules easy.js uses),
 * skips buying shares for rollout speed, then draws back to end the turn.
 */
function applyPlacementTurn(state, playerId, sectorId) {
  let next = placeTile(state, playerId, sectorId);

  if (next.turnPhase === "choosingCorporationToFound") {
    const available = getAvailableCorporations(next.corporations);
    next = foundCorporation(next, randomItem(available).id);
  }

  if (next.turnPhase === "choosingMergerSurvivor") {
    next = applyMergerSurvivor(next, randomItem(next.pendingMerger.candidateSurvivorIds));
  }

  while (next.turnPhase === "resolvingMerger") {
    const { playerId: shareholderId, corporationId } = next.pendingMerger.shareholderDecisions[0];
    const shareholder = next.players.find((p) => p.id === shareholderId);
    const shareCount = shareholder.shares[corporationId] ?? 0;
    next = decideShareDisposition(next, shareholderId, corporationId, { sell: shareCount, trade: 0, hold: 0 });
  }

  return drawTile(next, playerId);
}

/** Plays one uniformly-random legal turn for whichever player is current. */
function playRandomTurn(state) {
  const playerId = state.players[state.currentPlayerIndex].id;
  const legalPlacements = getLegalPlacements(state, playerId);
  if (legalPlacements.length === 0) {
    // Extremely rare (the whole hand simultaneously dead) — bail out rather
    // than loop forever; the caller's ply cap keeps this bounded regardless.
    return state;
  }
  return applyPlacementTurn(state, playerId, randomItem(legalPlacements));
}

/** Applies the candidate root action, plays a bounded number of further
 * random turns, then evaluates the result for the root AI player. */
function rollout(determinizedState, aiPlayerId, rootSectorId) {
  let state = applyPlacementTurn(determinizedState, aiPlayerId, rootSectorId);
  for (let ply = 1; ply < MAX_ROLLOUT_PLIES; ply += 1) {
    state = playRandomTurn(state);
  }
  return evaluateState(state, aiPlayerId);
}

function selectRootActionViaUcb1(legalPlacements, stats) {
  let totalVisits = 0;
  for (const sectorId of legalPlacements) totalVisits += stats.get(sectorId).visits;

  let bestSectorId = legalPlacements[0];
  let bestScore = -Infinity;
  for (const sectorId of legalPlacements) {
    const { visits, totalValue } = stats.get(sectorId);
    if (visits === 0) return sectorId; // always try unvisited actions first
    const score = totalValue / visits + UCB1_EXPLORATION_CONSTANT * Math.sqrt(Math.log(totalVisits) / visits);
    if (score > bestScore) {
      bestScore = score;
      bestSectorId = sectorId;
    }
  }
  return bestSectorId;
}

function createStats(legalPlacements) {
  return new Map(legalPlacements.map((sectorId) => [sectorId, { visits: 0, totalValue: 0 }]));
}

async function searchBestPlacement(view, aiPlayerId, legalPlacements) {
  const combinedStats = createStats(legalPlacements);
  const perDeterminizationBudgetMs = TOTAL_TIME_BUDGET_MS / DETERMINIZATION_COUNT;

  for (let d = 0; d < DETERMINIZATION_COUNT; d += 1) {
    const determinizedState = determinizeHiddenState(view, aiPlayerId);
    const localStats = createStats(legalPlacements);
    const deadline = performance.now() + perDeterminizationBudgetMs;
    let rolloutsSinceYield = 0;

    while (performance.now() < deadline) {
      const sectorId = selectRootActionViaUcb1(legalPlacements, localStats);
      const value = rollout(determinizedState, aiPlayerId, sectorId);
      const entry = localStats.get(sectorId);
      entry.visits += 1;
      entry.totalValue += value;

      rolloutsSinceYield += 1;
      if (rolloutsSinceYield >= ROLLOUTS_PER_YIELD) {
        rolloutsSinceYield = 0;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    for (const [sectorId, { visits, totalValue }] of localStats) {
      const combined = combinedStats.get(sectorId);
      combined.visits += visits;
      combined.totalValue += totalValue;
    }
  }

  let bestSectorId = legalPlacements[0];
  let bestAverage = -Infinity;
  for (const [sectorId, { visits, totalValue }] of combinedStats) {
    if (visits === 0) continue;
    const average = totalValue / visits;
    if (average > bestAverage) {
      bestAverage = average;
      bestSectorId = sectorId;
    }
  }
  return bestSectorId;
}

/**
 * Async, unlike every other tier's choosePlacementAction — see this file's
 * top comment. Skips the search entirely when there's zero or one legal
 * placement, since there's no real decision to make.
 */
export async function choosePlacementAction(view, playerId) {
  const legalPlacements = getLegalPlacements(view, playerId);
  if (legalPlacements.length === 0) {
    const player = view.players.find((p) => p.id === playerId);
    const deadSectorId = player.hand.find((sectorId) => isDeadTile(view, sectorId));
    return { action: "exchange", sectorId: deadSectorId };
  }
  if (legalPlacements.length === 1) {
    return { action: "place", sectorId: legalPlacements[0] };
  }

  const bestSectorId = await searchBestPlacement(view, playerId, legalPlacements);
  return { action: "place", sectorId: bestSectorId };
}
