// The orchestration layer: the state-transition functions from
// docs/game-engine-api.md that drive the full turnPhase state machine
// (placingTile -> [choosingCorporationToFound | choosingMergerSurvivor] ->
// resolvingMerger -> buyingShares -> drawingTile -> next player), built by
// composing every other file in js/model/. This is the only file that knows
// how those pieces fit together turn-to-turn.

import { createEmptyBoard, placeSectorOnBoard, setSectorCorporation } from "./board.js";
import {
  createInitialCorporations,
  getPrice,
  isActive,
  isSecure,
  getActiveCorporations,
  getAvailableCorporations,
  setCorporationSectors,
} from "./corporations.js";
import { createPlayer, addToHand, removeFromHand, getShareCount, adjustShares, adjustCredits } from "./players.js";
import { createBank, drawFromPool, removeSharesFromBank, addSharesToBank } from "./bank.js";
import { analyzePlacement, isDeadTile, getLegalPlacements } from "./placement.js";
import {
  findLargestAmong,
  calculateMergerBonuses,
  buildShareholderDecisionQueue,
  absorbCorporation,
} from "./merger.js";
import { HAND_SIZE, MAX_SHARES_PURCHASED_PER_TURN, ENDGAME_THRESHOLD } from "./constants.js";

// Re-exported so UI/AI code can reach these through js/model/index.js without
// needing to know they actually live in placement.js.
export { analyzePlacement, isDeadTile, getLegalPlacements };

/** Appends one entry to the event log. `type` is a short machine-readable
 * tag (e.g. "placement", "merger"); `message` is the screen-reader-friendly
 * text the UI displays verbatim (see docs/data-model.md's eventLog note). */
function appendEvent(gameState, type, message) {
  return [...gameState.eventLog, { type, message, turnNumber: gameState.turnNumber }];
}

function assertCurrentPlayer(gameState, playerId) {
  if (gameState.players[gameState.currentPlayerIndex].id !== playerId) {
    throw new Error(`It is not player ${playerId}'s turn.`);
  }
}

function assertPhase(gameState, expectedPhase) {
  if (gameState.turnPhase !== expectedPhase) {
    throw new Error(`Expected turnPhase "${expectedPhase}", but it is "${gameState.turnPhase}".`);
  }
}

/**
 * Sets up a brand-new game: an empty board, all 7 corporations present at
 * zero sectors, a shuffled bank, and every player dealt up to HAND_SIZE
 * sectors. `playerConfigs` is an array of { id, name, isHuman }, in turn
 * order — the first entry acts first.
 */
export function createGame(playerConfigs) {
  let bank = createBank();
  const players = playerConfigs.map(({ id, name, isHuman }) => {
    let player = createPlayer(id, name, isHuman);
    for (let i = 0; i < HAND_SIZE; i += 1) {
      const drawn = drawFromPool(bank);
      bank = drawn.bank;
      if (drawn.sectorId !== null) {
        player = addToHand(player, drawn.sectorId);
      }
    }
    return player;
  });

  return {
    board: createEmptyBoard(),
    corporations: createInitialCorporations(),
    players,
    bank,
    currentPlayerIndex: 0,
    turnPhase: "placingTile",
    eventLog: [],
    pendingFounding: null,
    pendingMerger: null,
    sharesPurchasedThisTurn: 0,
    turnNumber: 1,
  };
}

/**
 * Assigns `sectorsToAssign` to `corporationId` on the board and in the
 * corporations map, and grants the founder's free share if the bank has one
 * available (founding is still legal without one — the bank simply runs out
 * of that corporation's shares before anyone's founded it, an edge case
 * more relevant once players can also just buy remaining shares down to 0).
 * Returns the updated board/corporations/bank/players plus a message
 * describing what happened, for the caller to fold into the event log.
 */
function applyFounding(gameState, corporationId, sectorsToAssign, founderId) {
  let board = gameState.board;
  for (const sectorId of sectorsToAssign) {
    board = setSectorCorporation(board, sectorId, corporationId);
  }
  const corporations = setCorporationSectors(
    gameState.corporations,
    corporationId,
    new Set(sectorsToAssign),
  );

  let bank = gameState.bank;
  let players = gameState.players;
  let message = `${corporations[corporationId].name} founded with ${sectorsToAssign.length} sectors.`;
  if (bank.sharesRemaining[corporationId] > 0) {
    bank = removeSharesFromBank(bank, corporationId, 1);
    players = players.map((player) =>
      player.id === founderId ? adjustShares(player, corporationId, 1) : player,
    );
    message += " Founder receives 1 free share.";
  }

  return { board, corporations, bank, players, message };
}

/**
 * Kicks off merger resolution once a survivor is known (either immediately,
 * when there was no tie, or after chooseMergerSurvivor()). Snapshots each
 * absorbed corporation's price and builds the shareholder decision queue
 * BEFORE absorbing sectors — both depend on the absorbed corporations'
 * pre-merger sizes, which absorption would otherwise erase (an absorbed
 * corporation's sectors.size drops to 0 the instant its tiles move to the
 * survivor).
 */
function beginMergerResolution(gameState, survivorId, absorbedIds) {
  const snapshotPrices = {};
  for (const id of absorbedIds) {
    snapshotPrices[id] = getPrice(gameState.corporations[id]);
  }

  const shareholderDecisions = buildShareholderDecisionQueue(gameState, absorbedIds);

  let { board, corporations } = gameState;
  for (const absorbedId of absorbedIds) {
    ({ board, corporations } = absorbCorporation(board, corporations, survivorId, absorbedId));
  }

  return {
    board,
    corporations,
    turnPhase: "resolvingMerger",
    pendingFounding: null,
    pendingMerger: {
      survivorId,
      absorbedIds,
      snapshotPrices,
      shareholderDecisions,
      bonusesPaid: [],
    },
  };
}

/**
 * Moves a tile from the player's hand onto the board, then advances
 * turnPhase based on what analyzePlacement() reports. Throws if sectorId is
 * a dead tile — callers must check isDeadTile() (or filter through
 * getLegalPlacements()) first, per docs/game-engine-api.md.
 */
export function placeTile(gameState, playerId, sectorId) {
  assertPhase(gameState, "placingTile");
  assertCurrentPlayer(gameState, playerId);
  const actingPlayer = gameState.players.find((p) => p.id === playerId);
  if (!actingPlayer.hand.includes(sectorId)) {
    throw new Error(`${actingPlayer.name} does not hold sector ${sectorId}.`);
  }
  if (isDeadTile(gameState, sectorId)) {
    throw new Error(`Sector ${sectorId} is a dead tile and cannot be placed.`);
  }

  const analysis = analyzePlacement(gameState, sectorId);
  const players = gameState.players.map((player) =>
    player.id === playerId ? removeFromHand(player, sectorId) : player,
  );
  const board = placeSectorOnBoard(gameState.board, sectorId, null);
  const working = { ...gameState, board, players };

  if (analysis.effect === "none") {
    return {
      ...working,
      turnPhase: "buyingShares",
      eventLog: appendEvent(working, "placement", `Sector ${sectorId} placed — unincorporated.`),
    };
  }

  if (analysis.effect === "grow") {
    const { corporationId, sectors } = analysis;
    let nextBoard = working.board;
    for (const id of sectors) {
      nextBoard = setSectorCorporation(nextBoard, id, corporationId);
    }
    const nextSectors = new Set([...working.corporations[corporationId].sectors, ...sectors]);
    const corporations = setCorporationSectors(working.corporations, corporationId, nextSectors);
    return {
      ...working,
      board: nextBoard,
      corporations,
      turnPhase: "buyingShares",
      eventLog: appendEvent(
        { ...working, corporations },
        "growth",
        `Sector ${sectorId} placed — ${corporations[corporationId].name} grows to ${nextSectors.size} sectors.`,
      ),
    };
  }

  if (analysis.effect === "found") {
    const availableCorporations = getAvailableCorporations(working.corporations);
    if (availableCorporations.length === 1) {
      // Only one legal name left — skip choosingCorporationToFound
      // automatically, per docs/game-engine-api.md.
      const { message, ...founded } = applyFounding(
        working,
        availableCorporations[0].id,
        analysis.sectors,
        playerId,
      );
      const nextState = { ...working, ...founded };
      return {
        ...nextState,
        turnPhase: "buyingShares",
        eventLog: appendEvent(nextState, "founding", `Sector ${sectorId} placed — ${message}`),
      };
    }
    return {
      ...working,
      pendingFounding: analysis.sectors,
      turnPhase: "choosingCorporationToFound",
      eventLog: appendEvent(
        working,
        "founding",
        `Sector ${sectorId} placed — choose a corporation to found.`,
      ),
    };
  }

  // analysis.effect === "merger"
  const { corporationIds } = analysis;
  const largest = findLargestAmong(working.corporations, corporationIds);
  const mergerNames = corporationIds.map((id) => working.corporations[id].name).join(", ");

  if (largest.length > 1) {
    return {
      ...working,
      pendingMerger: { candidateSurvivorIds: largest, corporationIds },
      turnPhase: "choosingMergerSurvivor",
      eventLog: appendEvent(
        working,
        "merger",
        `Sector ${sectorId} placed — merges ${mergerNames}; choose the surviving corporation.`,
      ),
    };
  }

  const survivorId = largest[0];
  const absorbedIds = corporationIds.filter((id) => id !== survivorId);
  const resolution = beginMergerResolution(working, survivorId, absorbedIds);
  const nextState = { ...working, ...resolution };
  return {
    ...nextState,
    eventLog: appendEvent(
      working,
      "merger",
      `Sector ${sectorId} placed — ${working.corporations[survivorId].name} absorbs ${absorbedIds
        .map((id) => working.corporations[id].name)
        .join(", ")}.`,
    ),
  };
}

/**
 * Used when turnPhase is "choosingCorporationToFound". Assigns
 * gameState.pendingFounding's sectors to the chosen corporation, grants the
 * founder's free share if available, clears pendingFounding, advances to
 * "buyingShares".
 */
export function foundCorporation(gameState, corporationId) {
  assertPhase(gameState, "choosingCorporationToFound");
  const founderId = gameState.players[gameState.currentPlayerIndex].id;
  const { message, ...founded } = applyFounding(
    gameState,
    corporationId,
    gameState.pendingFounding,
    founderId,
  );
  const nextState = { ...gameState, ...founded, pendingFounding: null, turnPhase: "buyingShares" };
  return { ...nextState, eventLog: appendEvent(nextState, "founding", message) };
}

/**
 * Used when turnPhase is "choosingMergerSurvivor". Records the chosen
 * survivor, absorbs every other tied-for-largest-or-smaller corporation
 * involved in the merger into it, and advances to "resolvingMerger".
 */
export function chooseMergerSurvivor(gameState, corporationId) {
  assertPhase(gameState, "choosingMergerSurvivor");
  const { candidateSurvivorIds, corporationIds } = gameState.pendingMerger;
  if (!candidateSurvivorIds.includes(corporationId)) {
    throw new Error(`${corporationId} is not tied for the largest corporation in this merger.`);
  }
  const absorbedIds = corporationIds.filter((id) => id !== corporationId);
  const resolution = beginMergerResolution(gameState, corporationId, absorbedIds);
  const nextState = { ...gameState, ...resolution };
  return {
    ...nextState,
    eventLog: appendEvent(
      gameState,
      "merger",
      `${gameState.corporations[corporationId].name} chosen to survive the merger.`,
    ),
  };
}

/**
 * Used once per shareholder per absorbed corporation while turnPhase is
 * "resolvingMerger". decision = { sell, trade, hold } must add up to that
 * player's share count in `corporationId`. Pays the majority/minority bonus
 * automatically the first time this absorbed corporation is processed (using
 * the price snapshotted when the merger began, not the corporation's current
 * — now zero — size). Once every pending decision is resolved, clears
 * pendingMerger and advances to "buyingShares".
 */
export function decideShareDisposition(gameState, playerId, corporationId, decision) {
  assertPhase(gameState, "resolvingMerger");
  const { pendingMerger } = gameState;
  const [nextDue, ...remainingQueue] = pendingMerger.shareholderDecisions;
  if (!nextDue || nextDue.playerId !== playerId || nextDue.corporationId !== corporationId) {
    throw new Error("This is not the next pending shareholder decision.");
  }

  const player = gameState.players.find((p) => p.id === playerId);
  const shareCount = getShareCount(player, corporationId);
  if (decision.sell + decision.trade + decision.hold !== shareCount) {
    throw new Error("sell + trade + hold must add up to the player's full holding.");
  }
  if (decision.trade % 2 !== 0) {
    throw new Error("Shares can only be traded in pairs (2 absorbed shares per 1 survivor share).");
  }

  const price = pendingMerger.snapshotPrices[corporationId];
  let players = gameState.players;
  let bank = gameState.bank;
  const eventMessages = [];

  // Pay the majority/minority bonus the first time this absorbed
  // corporation is processed — based on holdings as of the merger, before
  // any shareholder (including this one) has sold or traded anything.
  let bonusesPaid = pendingMerger.bonusesPaid;
  if (!bonusesPaid.includes(corporationId)) {
    const payouts = calculateMergerBonuses(corporationId, price, players);
    for (const [payoutPlayerId, amount] of Object.entries(payouts)) {
      players = players.map((p) => (p.id === payoutPlayerId ? adjustCredits(p, amount) : p));
      const payoutPlayer = players.find((p) => p.id === payoutPlayerId);
      eventMessages.push(
        `${payoutPlayer.name} receives a ${amount}-credit merger bonus for ${gameState.corporations[corporationId].name}.`,
      );
    }
    bonusesPaid = [...bonusesPaid, corporationId];
  }

  if (decision.trade > 0) {
    const survivorSharesNeeded = decision.trade / 2;
    if (bank.sharesRemaining[pendingMerger.survivorId] < survivorSharesNeeded) {
      throw new Error("Not enough survivor shares remaining in the bank to complete this trade.");
    }
  }

  players = players.map((p) => {
    if (p.id !== playerId) return p;
    let updated = adjustShares(p, corporationId, -(decision.sell + decision.trade));
    updated = adjustCredits(updated, decision.sell * price);
    if (decision.trade > 0) {
      updated = adjustShares(updated, pendingMerger.survivorId, decision.trade / 2);
    }
    return updated;
  });

  // Sold and traded-away shares both return to the bank; traded-in survivor
  // shares leave it.
  bank = addSharesToBank(bank, corporationId, decision.sell + decision.trade);
  if (decision.trade > 0) {
    bank = removeSharesFromBank(bank, pendingMerger.survivorId, decision.trade / 2);
  }

  eventMessages.push(
    `${player.name} disposes of ${shareCount} ${gameState.corporations[corporationId].name} share(s): ${decision.sell} sold, ${decision.trade} traded, ${decision.hold} held.`,
  );

  let eventLog = gameState.eventLog;
  for (const message of eventMessages) {
    eventLog = appendEvent({ ...gameState, eventLog }, "merger", message);
  }

  const isLastDecision = remainingQueue.length === 0;
  return {
    ...gameState,
    players,
    bank,
    eventLog,
    pendingMerger: isLastDecision
      ? null
      : { ...pendingMerger, shareholderDecisions: remainingQueue, bonusesPaid },
    turnPhase: isLastDecision ? "buyingShares" : "resolvingMerger",
  };
}

/**
 * Buys `quantity` shares of one corporation, committing immediately.
 * Validates the per-turn cap of 3 total shares, bank availability, and the
 * player's credits. Does NOT advance turnPhase — buyingShares stays active
 * until the player calls drawTile() to end their turn.
 */
export function buyShares(gameState, playerId, corporationId, quantity = 1) {
  assertPhase(gameState, "buyingShares");
  assertCurrentPlayer(gameState, playerId);

  if (gameState.sharesPurchasedThisTurn + quantity > MAX_SHARES_PURCHASED_PER_TURN) {
    throw new Error(`Cannot buy more than ${MAX_SHARES_PURCHASED_PER_TURN} shares in one turn.`);
  }
  const corporation = gameState.corporations[corporationId];
  if (!isActive(corporation)) {
    throw new Error(`${corporationId} has not been founded yet — no shares to buy.`);
  }
  if (gameState.bank.sharesRemaining[corporationId] < quantity) {
    throw new Error(`The bank does not have ${quantity} shares of ${corporation.name} left.`);
  }
  const price = getPrice(corporation);
  const totalCost = price * quantity;
  const player = gameState.players.find((p) => p.id === playerId);
  if (player.credits < totalCost) {
    throw new Error(`${player.name} cannot afford ${quantity} share(s) of ${corporation.name}.`);
  }

  const players = gameState.players.map((p) => {
    if (p.id !== playerId) return p;
    return adjustCredits(adjustShares(p, corporationId, quantity), -totalCost);
  });
  const bank = removeSharesFromBank(gameState.bank, corporationId, quantity);
  const working = { ...gameState, players, bank };

  return {
    ...working,
    sharesPurchasedThisTurn: gameState.sharesPurchasedThisTurn + quantity,
    eventLog: appendEvent(
      working,
      "sharesPurchased",
      `${player.name} buys ${quantity} share(s) of ${corporation.name} for ${totalCost} credits.`,
    ),
  };
}

/**
 * Refills the acting player's hand back up to HAND_SIZE, appends a
 * turn-summary event, advances currentPlayerIndex to the next player, and
 * resets turnPhase to "placingTile" for them.
 */
export function drawTile(gameState, playerId) {
  assertPhase(gameState, "buyingShares");
  assertCurrentPlayer(gameState, playerId);

  const player = gameState.players.find((p) => p.id === playerId);
  let bank = gameState.bank;
  let updatedPlayer = player;
  const sectorsNeeded = HAND_SIZE - player.hand.length;
  for (let i = 0; i < sectorsNeeded; i += 1) {
    const drawn = drawFromPool(bank);
    bank = drawn.bank;
    if (drawn.sectorId === null) break; // pool exhausted — hand stays short
    updatedPlayer = addToHand(updatedPlayer, drawn.sectorId);
  }

  const players = gameState.players.map((p) => (p.id === playerId ? updatedPlayer : p));
  const working = { ...gameState, players, bank };
  const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

  return {
    ...working,
    currentPlayerIndex: nextPlayerIndex,
    turnPhase: "placingTile",
    sharesPurchasedThisTurn: 0,
    turnNumber: gameState.turnNumber + 1,
    eventLog: appendEvent(working, "turnEnded", `${player.name} ends their turn.`),
  };
}

/**
 * Implements the "prove it's dead, discard, redraw" rule: validates that
 * sectorId is both in the player's hand and a genuine dead tile, swaps it
 * for a fresh draw. Does not consume the turn or change turnPhase.
 */
export function exchangeDeadTile(gameState, playerId, sectorId) {
  assertPhase(gameState, "placingTile");
  assertCurrentPlayer(gameState, playerId);

  const player = gameState.players.find((p) => p.id === playerId);
  if (!player.hand.includes(sectorId)) {
    throw new Error(`${player.name} does not hold sector ${sectorId}.`);
  }
  if (!isDeadTile(gameState, sectorId)) {
    throw new Error(`Sector ${sectorId} is not a dead tile.`);
  }

  const drawn = drawFromPool(gameState.bank);
  let updatedPlayer = removeFromHand(player, sectorId);
  if (drawn.sectorId !== null) {
    updatedPlayer = addToHand(updatedPlayer, drawn.sectorId);
  }
  const players = gameState.players.map((p) => (p.id === playerId ? updatedPlayer : p));
  const working = { ...gameState, players, bank: drawn.bank };

  return {
    ...working,
    eventLog: appendEvent(
      working,
      "deadTileExchanged",
      `${player.name} exchanges dead sector ${sectorId} for a new one.`,
    ),
  };
}

/**
 * True once ending the game is an available choice: some corporation has
 * grown to 41+ sectors, or every currently active corporation is secure.
 */
export function isEndGameAvailable(gameState) {
  const active = getActiveCorporations(gameState.corporations);
  if (active.length === 0) return false;
  if (active.some((corporation) => corporation.sectors.size >= ENDGAME_THRESHOLD)) return true;
  return active.every((corporation) => isSecure(corporation));
}

/**
 * Voluntary end-of-game action. Liquidates every active corporation (paying
 * majority/minority bonuses exactly as a merger would, then cashing out
 * every remaining share at that corporation's current price), and sets
 * turnPhase to "gameOver" with final per-player credit totals recorded.
 */
export function endGame(gameState, playerId) {
  assertCurrentPlayer(gameState, playerId);
  if (!isEndGameAvailable(gameState)) {
    throw new Error("End game is not available yet.");
  }

  let players = gameState.players;
  let eventLog = gameState.eventLog;

  for (const corporation of getActiveCorporations(gameState.corporations)) {
    const price = getPrice(corporation);
    const payouts = calculateMergerBonuses(corporation.id, price, players);
    for (const [payoutPlayerId, amount] of Object.entries(payouts)) {
      players = players.map((p) => (p.id === payoutPlayerId ? adjustCredits(p, amount) : p));
    }
    players = players.map((p) => {
      const shareCount = getShareCount(p, corporation.id);
      if (shareCount === 0) return p;
      return adjustShares(adjustCredits(p, shareCount * price), corporation.id, -shareCount);
    });
    eventLog = appendEvent(
      { ...gameState, eventLog },
      "liquidation",
      `${corporation.name} liquidated at ${price} credits/share.`,
    );
  }

  const finalStandings = [...players]
    .map(({ id, name, credits }) => ({ playerId: id, name, credits }))
    .sort((a, b) => b.credits - a.credits);

  return { ...gameState, players, eventLog, turnPhase: "gameOver", finalStandings };
}

/**
 * Redacted copy of gameState for a given player — the ONLY view the UI and
 * the AI are allowed to read from (see docs/data-model.md's "Public vs.
 * private information" section). Public fields (board, corporations, bank,
 * eventLog) pass through unchanged; the requesting player's own hand/
 * shares/credits are included in full; every OTHER player's hand/shares/
 * credits are removed entirely and replaced with just handSize, since
 * per docs/data-model.md even cumulative holdings and cash totals — not
 * just hand contents — are private, not merely hidden-in-detail.
 */
export function getViewFor(gameState, playerId) {
  return {
    ...gameState,
    players: gameState.players.map((player) => {
      if (player.id === playerId) return player;
      return {
        id: player.id,
        name: player.name,
        isHuman: player.isHuman,
        handSize: player.hand.length,
      };
    }),
  };
}
