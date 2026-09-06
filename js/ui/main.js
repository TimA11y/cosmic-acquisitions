// Entry point. Wires index.html's DOM to js/model/'s pure engine functions
// and drives a stub easy-tier AI opponent (js/ai/easy.js). This is a
// deliberately scoped-down "placement slice" (see the project plan this was
// built from): only the placingTile -> buyingShares -> drawTile loop has
// real dialogs. Founding and merger decisions are fully handled when the AI
// triggers them (the easy tier's random/fixed-rule choices are simple
// enough to always resolve automatically), but if the HUMAN ever needs to
// make one of those decisions, there's no dialog for it yet — see
// showUnsupportedPhaseMessage() below, which surfaces that honestly instead
// of freezing or crashing.

import {
  createGame,
  placeTile,
  foundCorporation,
  chooseMergerSurvivor,
  decideShareDisposition,
  buyShares,
  drawTile,
  exchangeDeadTile,
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
import { renderTurnStatus, renderStarMap, renderYourShip, renderMarket, renderEventLog } from "./render.js";

const HUMAN_ID = "you";
const AI_ID = "nebula-ai";
const AI_TURN_DELAY_MS = 500;

const elements = {
  turnStatus: document.getElementById("turn-status"),
  unsupportedMessage: document.getElementById("unsupported-phase-message"),
  starMapTable: document.getElementById("star-map-table"),
  credits: document.getElementById("credits-display"),
  handList: document.getElementById("hand-list"),
  sharesList: document.getElementById("shares-list"),
  endTurnButton: document.getElementById("end-turn-button"),
  marketStatus: document.getElementById("share-purchase-status"),
  marketTableBody: document.getElementById("market-table-body"),
  eventLogList: document.getElementById("event-log-list"),
  placementDialog: document.getElementById("placement-dialog"),
  placementDialogMessage: document.getElementById("placement-dialog-message"),
  placementDialogCancel: document.getElementById("placement-dialog-cancel"),
  placementDialogConfirm: document.getElementById("placement-dialog-confirm"),
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
    },
    { onHandTileClick: openPlacementDialog, onEndTurn: handleEndTurn },
  );
  renderMarket(
    view,
    HUMAN_ID,
    { statusEl: elements.marketStatus, tableBodyEl: elements.marketTableBody },
    { onBuy: handleBuyShares },
  );
  renderEventLog(view, elements.eventLogList);
}

function showUnsupportedPhaseMessage() {
  elements.unsupportedMessage.hidden = false;
  elements.unsupportedMessage.textContent =
    "This build doesn't support founding corporations or resolving mergers for you yet — reload the page to start a new game.";
}

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
      return (
        `Placing Sector ${sectorId} will let you found a new corporation. ` +
        `Founding isn't supported in this build yet — confirming will pause the game.`
      );
    case "merger": {
      const names = analysis.corporationIds.map((id) => gameState.corporations[id].name).join(" and ");
      return (
        `Placing Sector ${sectorId} will merge ${names}. ` +
        `Mergers aren't supported in this build yet — confirming will pause the game.`
      );
    }
    default:
      return `Placing Sector ${sectorId}.`;
  }
}

function openPlacementDialog(sectorId) {
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

  afterHumanTurnAction();
});

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

// --- Shared merger-resolution helper -----------------------------------
//
// Resolves every AI-held share-disposition decision at the front of the
// queue automatically (the easy tier's fixed "sell everything" rule), no
// matter whose turn triggered the merger. Stops the instant the front of
// the queue belongs to the human, since there's no dialog for that yet.

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

function humanMustActOnUnimplementedPhase() {
  if (gameState.turnPhase === "choosingCorporationToFound" || gameState.turnPhase === "choosingMergerSurvivor") {
    return true;
  }
  return (
    gameState.turnPhase === "resolvingMerger" &&
    gameState.pendingMerger.shareholderDecisions[0]?.playerId === HUMAN_ID
  );
}

function afterHumanTurnAction() {
  autoResolveAiMergerDecisions();

  if (humanMustActOnUnimplementedPhase()) {
    render();
    showUnsupportedPhaseMessage();
    return;
  }

  render();
  maybeStartAiTurn();
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

  autoResolveAiMergerDecisions();

  if (humanMustActOnUnimplementedPhase()) {
    render();
    showUnsupportedPhaseMessage();
    return;
  }

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

// --- Go ------------------------------------------------------------------

render();
maybeStartAiTurn();
