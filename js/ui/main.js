// Entry point. Wires index.html's DOM to js/model/'s pure engine functions
// and drives a stub easy-tier AI opponent (js/ai/easy.js). Covers the full
// turnPhase state machine now: placing tiles, founding corporations,
// resolving mergers (including tie-breaking survivor choice and every
// shareholder's sell/trade/hold decision), buying shares, ending turns, and
// voluntarily ending the game once isEndGameAvailable() allows it.

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
import {
  choosePlacementAction,
  chooseRandomCorporationToFound,
  chooseRandomMergerSurvivor,
  decideSellEverything,
  chooseRandomShareBuy,
} from "../ai/easy.js";
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
} from "./render.js";

const HUMAN_ID = "you";
const AI_ID = "nebula-ai";
const AI_TURN_DELAY_MS = 500;

const elements = {
  turnStatus: document.getElementById("turn-status"),
  noticeMessage: document.getElementById("notice-message"),
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

// "Player 1" rather than "You" as the display name — the event log's
// messages are written in the third person for every player uniformly
// (e.g. "Player 1 buys 2 shares..."), and "You" would read oddly there
// ("You ends their turn.") even though "Your Ship"/"Your turn" elsewhere in
// the UI address the human directly by design.
let gameState = createGame([
  { id: HUMAN_ID, name: "Player 1", isHuman: true },
  { id: AI_ID, name: "Nebula AI", isHuman: false },
]);

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

makeMandatory(elements.foundingDialog, "You must choose a corporation to continue.");
makeMandatory(elements.mergerSurvivorDialog, "You must choose which corporation survives to continue.");
makeMandatory(
  elements.shareDispositionDialog,
  "You must decide what to do with these shares to continue.",
);

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

/**
 * Resolves every AI-held share-disposition decision at the front of the
 * queue automatically (the easy tier's fixed "sell everything" rule), no
 * matter whose turn triggered the merger. Stops the instant the front of
 * the queue belongs to the human.
 */
function autoResolveAiMergerDecisions() {
  while (
    gameState.turnPhase === "resolvingMerger" &&
    gameState.pendingMerger.shareholderDecisions[0]?.playerId === AI_ID
  ) {
    const { corporationId } = gameState.pendingMerger.shareholderDecisions[0];
    const aiPlayer = gameState.players.find((p) => p.id === AI_ID);
    const shareCount = aiPlayer.shares[corporationId] ?? 0;
    gameState = decideShareDisposition(gameState, AI_ID, corporationId, decideSellEverything(shareCount));
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
  } catch (error) {
    console.error(error);
  }
  render();
  maybeStartAiTurn();
}

function handleEndGame() {
  try {
    gameState = endGame(gameState, HUMAN_ID);
  } catch (error) {
    console.error(error);
  }
  render();
}

// --- AI turn driver ---------------------------------------------------

function maybeStartAiTurn() {
  if (gameState.turnPhase === "gameOver") return;
  if (gameState.players[gameState.currentPlayerIndex].id !== AI_ID) return;
  setTimeout(runAiTurn, AI_TURN_DELAY_MS);
}

function runAiTurn() {
  const placementAction = choosePlacementAction(getViewFor(gameState, AI_ID), AI_ID);

  try {
    if (placementAction.action === "exchange") {
      gameState = exchangeDeadTile(gameState, AI_ID, placementAction.sectorId);
      render();
      setTimeout(runAiTurn, AI_TURN_DELAY_MS); // try again with the freshly-drawn sector
      return;
    }
    gameState = placeTile(gameState, AI_ID, placementAction.sectorId);
  } catch (error) {
    console.error("AI placement failed", error);
    render();
    return;
  }

  if (gameState.turnPhase === "choosingCorporationToFound") {
    const corporationId = chooseRandomCorporationToFound(getViewFor(gameState, AI_ID));
    gameState = foundCorporation(gameState, corporationId);
  }

  if (gameState.turnPhase === "choosingMergerSurvivor") {
    const corporationId = chooseRandomMergerSurvivor(getViewFor(gameState, AI_ID));
    gameState = chooseMergerSurvivor(gameState, corporationId);
  }

  // If the human holds shares in whatever's being absorbed, this pauses
  // here and opens the disposition dialog for them mid-AI-turn, resuming
  // finishAiTurn() once they confirm.
  continueMergerResolution(finishAiTurn);
}

function finishAiTurn() {
  const buyChoice = chooseRandomShareBuy(getViewFor(gameState, AI_ID), AI_ID);
  if (buyChoice) {
    try {
      gameState = buyShares(gameState, AI_ID, buyChoice.corporationId, buyChoice.quantity);
    } catch (error) {
      console.error("AI share purchase failed", error);
    }
  }
  render();

  setTimeout(() => {
    gameState = drawTile(gameState, AI_ID);
    render();
    maybeStartAiTurn();
  }, AI_TURN_DELAY_MS);
}

// --- Test-only hooks --------------------------------------------------------
//
// Let BDD step definitions (steps/ui-steps.js) read the real, freshly
// created gameState (to get the actual HUMAN_ID/AI_ID and starting
// players/bank), build a specific board/corporation fixture on top of it —
// the same plain-object-spread pattern steps/model-steps.js already uses —
// and see it rendered, the same way a real player's actions would. Inert in
// normal play: two extra function references on window, never called
// unless a test calls them.
window.__getTestGameState = () => gameState;
window.__setTestGameState = (state) => {
  gameState = state;
  render();
};

// --- Go ------------------------------------------------------------------

render();
maybeStartAiTurn();
