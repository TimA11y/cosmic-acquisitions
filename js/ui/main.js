// Entry point. Wires index.html's DOM to js/model/'s pure engine functions
// and drives 1-5 AI opponents (js/ai/easy.js, js/ai/medium.js, dispatched
// per player by js/ai/index.js's getAiStrategy()), player count, names, and
// difficulty chosen via the setup dialog on load. Covers the full turnPhase
// state machine: placing tiles, founding corporations, resolving mergers
// (including tie-breaking survivor choice and every shareholder's
// sell/trade/hold decision), buying shares, ending turns, and voluntarily
// ending the game once isEndGameAvailable() allows it.

import {
  createGame,
  placeTile,
  foundCorporation,
  chooseMergerSurvivor,
  decideShareDisposition,
  buyShares,
  drawTile,
  exchangeDeadTile,
  endGame,
  getViewFor,
  analyzePlacement,
  isDeadTile,
} from "../model/index.js";
import { getAiStrategy } from "../ai/index.js";
import {
  renderTurnStatus,
  renderStarMap,
  renderYourShip,
  renderMarket,
  renderEventLog,
  renderFoundingDialog,
  renderMergerSurvivorDialog,
  renderShareDispositionDialog,
  renderFinalStandings,
  renderSetupAiRows,
  renderContextualHint,
  resetRevealAnimationState,
} from "./render.js";
import { loadSavedGame, saveGame, clearSavedGame } from "./storage.js";

const HUMAN_ID = "you";
const AI_TURN_DELAY_MS = 500;

const elements = {
  turnStatus: document.getElementById("turn-status"),
  noticeMessage: document.getElementById("notice-message"),
  howToPlayButton: document.getElementById("how-to-play-button"),
  helpDialog: document.getElementById("help-dialog"),
  helpDialogClose: document.getElementById("help-dialog-close"),
  contextualHint: document.getElementById("contextual-hint"),
  contextualHintText: document.getElementById("contextual-hint-text"),
  newGameButton: document.getElementById("new-game-button"),
  resumeDialog: document.getElementById("resume-dialog"),
  resumeGameButton: document.getElementById("resume-game-button"),
  newGameFromResumeButton: document.getElementById("new-game-from-resume-button"),
  confirmNewGameDialog: document.getElementById("confirm-new-game-dialog"),
  confirmNewGameCancel: document.getElementById("confirm-new-game-cancel"),
  confirmNewGameStart: document.getElementById("confirm-new-game-start"),
  setupDialog: document.getElementById("setup-dialog"),
  setupPlayerCount: document.getElementById("setup-player-count"),
  setupHumanName: document.getElementById("setup-human-name"),
  setupAiRows: document.getElementById("setup-ai-rows"),
  setupStartButton: document.getElementById("setup-start-button"),
  starMapTable: document.getElementById("star-map-table"),
  credits: document.getElementById("credits-display"),
  handList: document.getElementById("hand-list"),
  sharesList: document.getElementById("shares-list"),
  endTurnButton: document.getElementById("end-turn-button"),
  endGameButton: document.getElementById("end-game-button"),
  gameOverSection: document.getElementById("game-over"),
  finalStandingsList: document.getElementById("final-standings-list"),
  marketStatus: document.getElementById("share-purchase-status"),
  marketTableBody: document.getElementById("market-table-body"),
  eventLogList: document.getElementById("event-log-list"),
  placementDialog: document.getElementById("placement-dialog"),
  placementDialogMessage: document.getElementById("placement-dialog-message"),
  placementDialogCancel: document.getElementById("placement-dialog-cancel"),
  placementDialogConfirm: document.getElementById("placement-dialog-confirm"),
  foundingDialog: document.getElementById("founding-dialog"),
  foundingDialogMessage: document.getElementById("founding-dialog-message"),
  foundingChoiceList: document.getElementById("founding-choice-list"),
  mergerSurvivorDialog: document.getElementById("merger-survivor-dialog"),
  mergerSurvivorMessage: document.getElementById("merger-survivor-message"),
  mergerSurvivorChoiceList: document.getElementById("merger-survivor-choice-list"),
  shareDispositionDialog: document.getElementById("share-disposition-dialog"),
  shareDispositionMessage: document.getElementById("share-disposition-message"),
  dispositionSell: document.getElementById("disposition-sell"),
  dispositionTrade: document.getElementById("disposition-trade"),
  dispositionHold: document.getElementById("disposition-hold"),
  shareDispositionValidation: document.getElementById("share-disposition-validation"),
  shareDispositionConfirm: document.getElementById("share-disposition-confirm"),
};

// Nothing exists until the setup dialog is submitted (see "Setup dialog"
// below) — createGame() runs once, in the setupStartButton click handler.
let gameState = null;

// Per-AI-player difficulty, keyed by player id — kept here rather than on
// the model's Player object, since it's AI-dispatch metadata the engine
// itself has no use for. Looked up via js/ai/index.js's getAiStrategy() at
// every AI decision point. "Easy" and "Medium" are real tiers now; "Hard"
// is still offered in the setup dialog per docs/ai-design.md's confirmed
// 3-tier design but disabled there (MCTS is a separate, larger pass) — if
// it were ever selected anyway (or a resumed save has no entry at all),
// getAiStrategy() falls back to easy rather than crashing.
let aiDifficulties = {};

let pendingPlacementSectorId = null;

function render() {
  const view = getViewFor(gameState, HUMAN_ID);
  renderTurnStatus(view, HUMAN_ID, elements.turnStatus);
  renderStarMap(view, HUMAN_ID, elements.starMapTable, openPlacementDialog);
  renderYourShip(
    view,
    HUMAN_ID,
    {
      creditsEl: elements.credits,
      handListEl: elements.handList,
      sharesListEl: elements.sharesList,
      endTurnButtonEl: elements.endTurnButton,
      endGameButtonEl: elements.endGameButton,
    },
    { onHandTileClick: openPlacementDialog, onEndTurn: handleEndTurn, onEndGame: handleEndGame },
  );
  renderMarket(
    view,
    HUMAN_ID,
    { statusEl: elements.marketStatus, tableBodyEl: elements.marketTableBody },
    { onBuy: handleBuyShares },
  );
  renderEventLog(view, elements.eventLogList);
  renderFinalStandings(view, elements.gameOverSection, elements.finalStandingsList);
  renderContextualHint(view, HUMAN_ID, {
    detailsEl: elements.contextualHint,
    textEl: elements.contextualHintText,
  });
}

function showNotice(text) {
  elements.noticeMessage.hidden = false;
  elements.noticeMessage.textContent = text;
}

function clearNotice() {
  elements.noticeMessage.hidden = true;
}

/**
 * Founding, merger-survivor, and share-disposition are all "mandatory
 * decision" dialogs per docs/ui-design.md — there's no valid way to abandon
 * them mid-turn, so Escape/backdrop-click (both fire the dialog's `cancel`
 * event) are intercepted rather than allowed to close the dialog.
 */
function makeMandatory(dialogEl, explanation) {
  dialogEl.addEventListener("cancel", (event) => {
    event.preventDefault();
    showNotice(explanation);
  });
}

makeMandatory(elements.resumeDialog, "You must resume or start a game to continue.");
makeMandatory(elements.setupDialog, "You must start a game to continue.");
makeMandatory(elements.foundingDialog, "You must choose a corporation to continue.");
makeMandatory(elements.mergerSurvivorDialog, "You must choose which corporation survives to continue.");
makeMandatory(
  elements.shareDispositionDialog,
  "You must decide what to do with these shares to continue.",
);

// --- How to Play / contextual hints ---------------------------------------
//
// Unlike every other dialog here, help-dialog is freely dismissible — no
// makeMandatory() call — since reading reference material isn't a decision
// that needs to be intercepted (docs/help-design.md). Opening it also
// doesn't pause AI turns: maybeStartAiTurn()'s setTimeout scheduling has no
// idea this dialog exists, so an AI turn already in flight just keeps going
// in the background exactly as it would if the dialog were closed.

function openHelpDialog(sectionId) {
  elements.helpDialog.showModal();
  if (!sectionId) return;

  const target = elements.helpDialog.querySelector(`#${sectionId}`);
  if (!target) return;
  target.scrollIntoView();
  target.focus();
}

elements.howToPlayButton.addEventListener("click", () => openHelpDialog());
elements.helpDialogClose.addEventListener("click", () => elements.helpDialog.close());

// One delegated listener covers every contextual hint's "Learn more"
// control, since renderContextualHint() rebuilds that button's markup on
// every render rather than handing back a stable element to attach to.
elements.contextualHintText.addEventListener("click", (event) => {
  const sectionId = event.target.dataset.helpSection;
  if (sectionId) openHelpDialog(sectionId);
});

// --- Save / resume / new game --------------------------------------------

function showSetupDialog() {
  renderSetupAiRows(Number(elements.setupPlayerCount.value), elements.setupAiRows);
  elements.setupDialog.showModal();
}

let pendingResumeState = null;

elements.resumeGameButton.addEventListener("click", () => {
  gameState = pendingResumeState;
  pendingResumeState = null;
  // Seed with the restored board's already-occupied sectors, not empty —
  // otherwise every previously-placed tile would incorrectly "beam in"
  // at once on load instead of just appearing.
  resetRevealAnimationState(getViewFor(gameState, HUMAN_ID));
  elements.resumeDialog.close();
  elements.newGameButton.hidden = false;
  render();
  maybeStartAiTurn();
});

elements.newGameFromResumeButton.addEventListener("click", () => {
  clearSavedGame();
  elements.resumeDialog.close();
  showSetupDialog();
});

elements.newGameButton.addEventListener("click", () => {
  elements.confirmNewGameDialog.showModal();
});

elements.confirmNewGameCancel.addEventListener("click", () => {
  elements.confirmNewGameDialog.close();
});

elements.confirmNewGameStart.addEventListener("click", () => {
  clearSavedGame();
  gameState = null;
  aiDifficulties = {};
  elements.confirmNewGameDialog.close();
  elements.gameOverSection.hidden = true;
  clearNotice();
  showSetupDialog();
});

// --- Setup dialog -----------------------------------------------------

elements.setupPlayerCount.addEventListener("change", () => {
  renderSetupAiRows(Number(elements.setupPlayerCount.value), elements.setupAiRows);
});

elements.setupStartButton.addEventListener("click", () => {
  const humanName = elements.setupHumanName.value.trim() || "Player 1";
  const aiRows = [...elements.setupAiRows.querySelectorAll(".setup-ai-row")];

  const playerConfigs = [{ id: HUMAN_ID, name: humanName, isHuman: true }];
  aiDifficulties = {};
  aiRows.forEach((row, index) => {
    const aiId = `ai-${index + 1}`;
    const name = row.querySelector(".setup-ai-name").value.trim() || `AI Opponent ${index + 1}`;
    const difficulty = row.querySelector(".setup-ai-difficulty").value;
    playerConfigs.push({ id: aiId, name, isHuman: false });
    aiDifficulties[aiId] = difficulty;
  });

  gameState = createGame(playerConfigs);
  // A brand-new board has nothing occupied yet, so this player's very
  // first placements DO play the reveal animation.
  resetRevealAnimationState();
  elements.setupDialog.close();
  elements.newGameButton.hidden = false;
  render();
  maybeStartAiTurn();
});

// --- Placement dialog -----------------------------------------------------

function describePlacementOutcome(sectorId) {
  if (isDeadTile(gameState, sectorId)) {
    return `Sector ${sectorId} is dead — it will be discarded and replaced with a new sector.`;
  }

  const analysis = analyzePlacement(gameState, sectorId);
  switch (analysis.effect) {
    case "none":
      return `Placing Sector ${sectorId} will establish it as an unincorporated sector — no adjacent corporations.`;
    case "grow": {
      const corporation = gameState.corporations[analysis.corporationId];
      const sizeAfter = corporation.sectors.size + analysis.sectors.length;
      return `Placing Sector ${sectorId} will add it to ${corporation.name} (${sizeAfter} sectors after).`;
    }
    case "found":
      return `Placing Sector ${sectorId} will let you found a new corporation.`;
    case "merger": {
      const names = analysis.corporationIds.map((id) => gameState.corporations[id].name).join(" and ");
      return `Placing Sector ${sectorId} will merge ${names}.`;
    }
    default:
      return `Placing Sector ${sectorId}.`;
  }
}

function openPlacementDialog(sectorId) {
  clearNotice();
  pendingPlacementSectorId = sectorId;
  elements.placementDialogMessage.textContent = describePlacementOutcome(sectorId);
  elements.placementDialog.showModal();
}

elements.placementDialogCancel.addEventListener("click", () => {
  pendingPlacementSectorId = null;
  elements.placementDialog.close();
});

elements.placementDialogConfirm.addEventListener("click", () => {
  const sectorId = pendingPlacementSectorId;
  pendingPlacementSectorId = null;
  elements.placementDialog.close();
  if (!sectorId) return;

  try {
    gameState = isDeadTile(gameState, sectorId)
      ? exchangeDeadTile(gameState, HUMAN_ID, sectorId)
      : placeTile(gameState, HUMAN_ID, sectorId);
  } catch (error) {
    console.error(error);
    render();
    return;
  }

  afterHumanPlacement();
});

// --- Founding / merger-survivor / share-disposition dialogs --------------

function openFoundingDialog() {
  clearNotice();
  renderFoundingDialog(
    gameState,
    { messageEl: elements.foundingDialogMessage, listEl: elements.foundingChoiceList },
    (corporationId) => {
      elements.foundingDialog.close();
      gameState = foundCorporation(gameState, corporationId);
      // Founding always resolves straight to "buyingShares" — no further
      // merger machinery can follow from a founding decision.
      render();
      maybeStartAiTurn();
    },
  );
  elements.foundingDialog.showModal();
}

function openMergerSurvivorDialog() {
  clearNotice();
  renderMergerSurvivorDialog(
    gameState,
    { messageEl: elements.mergerSurvivorMessage, listEl: elements.mergerSurvivorChoiceList },
    (corporationId) => {
      elements.mergerSurvivorDialog.close();
      gameState = chooseMergerSurvivor(gameState, corporationId);
      continueMergerResolution(() => {
        render();
        maybeStartAiTurn();
      });
    },
  );
  elements.mergerSurvivorDialog.showModal();
}

function openShareDispositionDialog(decision, onResolved) {
  clearNotice();
  renderShareDispositionDialog(
    gameState,
    decision,
    {
      messageEl: elements.shareDispositionMessage,
      sellInput: elements.dispositionSell,
      tradeInput: elements.dispositionTrade,
      holdInput: elements.dispositionHold,
      validationEl: elements.shareDispositionValidation,
      confirmButton: elements.shareDispositionConfirm,
    },
    (decisionValues) => {
      elements.shareDispositionDialog.close();
      gameState = decideShareDisposition(gameState, decision.playerId, decision.corporationId, decisionValues);
      onResolved();
    },
  );
  elements.shareDispositionDialog.showModal();
}

function isHumanPlayer(playerId) {
  return gameState.players.find((p) => p.id === playerId).isHuman;
}

/**
 * Resolves every AI-held share-disposition decision at the front of the
 * queue automatically — using each AI's OWN difficulty tier's judgment
 * (js/ai/index.js's getAiStrategy()), not a single fixed rule — no matter
 * which AI player holds them or whose turn triggered the merger. With 1-5
 * AI opponents now possible (docs/ai-design.md's 2-6 total player design),
 * this can no longer assume a single fixed AI id or a single tier. Stops
 * the instant the front of the queue belongs to the human.
 */
function autoResolveAiMergerDecisions() {
  while (
    gameState.turnPhase === "resolvingMerger" &&
    gameState.pendingMerger.shareholderDecisions[0] &&
    !isHumanPlayer(gameState.pendingMerger.shareholderDecisions[0].playerId)
  ) {
    const { playerId, corporationId } = gameState.pendingMerger.shareholderDecisions[0];
    const aiPlayer = gameState.players.find((p) => p.id === playerId);
    const shareCount = aiPlayer.shares[corporationId] ?? 0;
    const strategy = getAiStrategy(aiDifficulties[playerId]);
    const decision = strategy.decideDisposition(
      getViewFor(gameState, playerId),
      playerId,
      corporationId,
      shareCount,
    );
    gameState = decideShareDisposition(gameState, playerId, corporationId, decision);
  }
}

/**
 * Auto-resolves every AI-held decision, then — if the human is next in the
 * queue — opens the disposition dialog for them and recurses once they
 * confirm. Once the queue is fully empty (turnPhase has left
 * "resolvingMerger"), calls `onFullyResolved`. This is the single
 * continuation both the human's own turn (a tied or untied merger they
 * triggered) and the AI's turn (a merger IT triggered, where the human
 * might still hold shares in the absorbed corporation) share — see the
 * project plan this was built from for why one function covers both
 * directions.
 */
function continueMergerResolution(onFullyResolved) {
  autoResolveAiMergerDecisions();
  render();

  if (gameState.turnPhase === "resolvingMerger") {
    const nextDecision = gameState.pendingMerger.shareholderDecisions[0];
    openShareDispositionDialog(nextDecision, () => continueMergerResolution(onFullyResolved));
    return;
  }

  onFullyResolved();
}

function afterHumanPlacement() {
  if (gameState.turnPhase === "choosingCorporationToFound") {
    openFoundingDialog();
    return;
  }
  if (gameState.turnPhase === "choosingMergerSurvivor") {
    openMergerSurvivorDialog();
    return;
  }
  continueMergerResolution(() => {
    render();
    maybeStartAiTurn();
  });
}

// --- Buying shares / ending the turn ---------------------------------------

function handleBuyShares(corporationId) {
  try {
    gameState = buyShares(gameState, HUMAN_ID, corporationId, 1);
  } catch (error) {
    console.error(error);
  }
  render();
}

function handleEndTurn() {
  try {
    gameState = drawTile(gameState, HUMAN_ID);
    saveGame(gameState); // autosave checkpoint, per docs/persistence-design.md
  } catch (error) {
    console.error(error);
  }
  render();
  maybeStartAiTurn();
}

function handleEndGame() {
  try {
    gameState = endGame(gameState, HUMAN_ID);
    clearSavedGame(); // nothing left to resume into once the game is over
  } catch (error) {
    console.error(error);
  }
  render();
}

// --- AI turn driver ---------------------------------------------------

function maybeStartAiTurn() {
  if (gameState.turnPhase === "gameOver") return;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (currentPlayer.isHuman) return;
  setTimeout(() => runAiTurn(currentPlayer.id), AI_TURN_DELAY_MS);
}

// async because the hard tier's choosePlacementAction() runs a time-boxed
// search that yields periodically (see js/ai/hard.js) — awaiting easy/
// medium's plain synchronous return values here is a harmless no-op, so
// this one signature works uniformly across every tier.
async function runAiTurn(aiPlayerId) {
  const strategy = getAiStrategy(aiDifficulties[aiPlayerId]);
  const placementAction = await strategy.choosePlacementAction(getViewFor(gameState, aiPlayerId), aiPlayerId);

  try {
    if (placementAction.action === "exchange") {
      gameState = exchangeDeadTile(gameState, aiPlayerId, placementAction.sectorId);
      render();
      setTimeout(() => runAiTurn(aiPlayerId), AI_TURN_DELAY_MS); // try again with the freshly-drawn sector
      return;
    }
    gameState = placeTile(gameState, aiPlayerId, placementAction.sectorId);
  } catch (error) {
    console.error("AI placement failed", error);
    render();
    return;
  }

  if (gameState.turnPhase === "choosingCorporationToFound") {
    const corporationId = strategy.chooseCorporationToFound(getViewFor(gameState, aiPlayerId), aiPlayerId);
    gameState = foundCorporation(gameState, corporationId);
  }

  if (gameState.turnPhase === "choosingMergerSurvivor") {
    const corporationId = strategy.chooseMergerSurvivor(getViewFor(gameState, aiPlayerId), aiPlayerId);
    gameState = chooseMergerSurvivor(gameState, corporationId);
  }

  // If the human (or another AI, with 3+ players) holds shares in whatever's
  // being absorbed, this pauses here — opening the disposition dialog if
  // it's the human's turn to decide — and resumes finishAiTurn() once
  // every decision is resolved.
  continueMergerResolution(() => finishAiTurn(aiPlayerId));
}

function finishAiTurn(aiPlayerId) {
  const strategy = getAiStrategy(aiDifficulties[aiPlayerId]);
  const buyChoice = strategy.chooseShareBuy(getViewFor(gameState, aiPlayerId), aiPlayerId);
  if (buyChoice) {
    try {
      gameState = buyShares(gameState, aiPlayerId, buyChoice.corporationId, buyChoice.quantity);
    } catch (error) {
      console.error("AI share purchase failed", error);
    }
  }
  render();

  setTimeout(() => {
    gameState = drawTile(gameState, aiPlayerId);
    saveGame(gameState); // autosave checkpoint, per docs/persistence-design.md
    render();
    maybeStartAiTurn();
  }, AI_TURN_DELAY_MS);
}

// --- Test-only hooks --------------------------------------------------------
//
// Let BDD step definitions (steps/ui-steps.js) read the real gameState
// created once the setup dialog is submitted (to get the actual player ids
// and starting players/bank), build a specific board/corporation fixture on
// top of it — the same plain-object-spread pattern steps/model-steps.js
// already uses — and see it rendered, the same way a real player's actions
// would. `getTestGameState()` returns null before setup completes. Inert in
// normal play: two extra function references on window, never called
// unless a test calls them.
window.__getTestGameState = () => gameState;
window.__setTestGameState = (state) => {
  gameState = state;
  resetRevealAnimationState(getViewFor(gameState, HUMAN_ID));
  render();
};

// --- Go ------------------------------------------------------------------

pendingResumeState = loadSavedGame();
if (pendingResumeState !== null) {
  elements.resumeDialog.showModal();
} else {
  showSetupDialog();
}
