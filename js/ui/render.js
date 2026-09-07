// Pure(-ish) DOM rendering. Every function here takes a REDACTED view (the
// output of js/model's getViewFor(), never the raw gameState — see
// docs/data-model.md's "Public vs. private information" rule) plus the DOM
// elements/callbacks it needs, and rebuilds that piece of the page. Full
// re-render on every state change rather than incremental patching — simple
// and plenty fast for a board this small, and avoids needing a virtual-DOM
// library that R3 (no frameworks) wouldn't allow anyway.

import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  formatSectorId,
  getPrice,
  isSecure,
  isActive,
  getAvailableCorporations,
  isEndGameAvailable,
  MAX_SHARES_PURCHASED_PER_TURN,
} from "../model/index.js";

function isCurrentPlayer(view, playerId) {
  return view.players[view.currentPlayerIndex].id === playerId;
}

/** Header's aria-live turn-status line — the only place turn changes are announced. */
export function renderTurnStatus(view, humanId, statusEl) {
  if (view.turnPhase === "gameOver") {
    statusEl.textContent = "Game over — see the Event Log for final standings.";
    return;
  }

  const currentPlayer = view.players[view.currentPlayerIndex];
  if (currentPlayer.id !== humanId) {
    statusEl.textContent = `${currentPlayer.name} is thinking…`;
    return;
  }

  const phaseText = {
    placingTile: "Your turn — place a Sector.",
    buyingShares: "Your turn — buy shares, or press End Turn.",
  }[view.turnPhase];
  statusEl.textContent = phaseText ?? `Your turn — phase: ${view.turnPhase}.`;
}

/**
 * The Star Map <table>. Per docs/ui-design.md, at most 6 cells are ever
 * interactive at once: only sectors in the human's hand, and only before
 * they've placed anything this turn (i.e. while turnPhase is still
 * "placingTile" — in this engine placing immediately advances the phase, so
 * "placingTile" and "hasn't placed yet" are exactly the same condition).
 */
export function renderStarMap(view, humanId, tableEl, onPlaceableCellClick) {
  const caption = tableEl.querySelector("caption");
  tableEl.innerHTML = "";
  if (caption) tableEl.appendChild(caption);

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  // The top-left corner cell isn't a header for any row or column, so it's
  // a plain <td> (an empty <th> would fail accessible-name checks).
  headerRow.appendChild(document.createElement("td"));
  for (let col = 1; col <= BOARD_COLUMNS; col += 1) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = String(col);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  tableEl.appendChild(thead);

  const isHumansPlacingTurn = view.turnPhase === "placingTile" && isCurrentPlayer(view, humanId);
  const humanHand = isHumansPlacingTurn ? view.players.find((p) => p.id === humanId).hand : [];

  const tbody = document.createElement("tbody");
  for (const row of BOARD_ROWS) {
    const tr = document.createElement("tr");
    const rowHeader = document.createElement("th");
    rowHeader.scope = "row";
    rowHeader.textContent = row;
    tr.appendChild(rowHeader);

    for (let col = 1; col <= BOARD_COLUMNS; col += 1) {
      const sectorId = formatSectorId(col, row);
      const td = document.createElement("td");
      const sector = view.board.get(sectorId);

      if (sector) {
        if (sector.corporationId === null) {
          td.innerHTML =
            `<span class="sector-star" aria-hidden="true">★</span>` +
            `<span class="visually-hidden">Sector ${sectorId}, unincorporated</span>`;
        } else {
          const corporation = view.corporations[sector.corporationId];
          const initial = corporation.name.charAt(0);
          td.innerHTML =
            `<span class="sector-star tier-${corporation.tier}" aria-hidden="true">★</span>` +
            `<span class="tier-${corporation.tier}">${initial}</span>` +
            `<span class="visually-hidden">Sector ${sectorId}, part of ${corporation.name}</span>`;
        }
      } else if (humanHand.includes(sectorId)) {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", `Place Sector ${sectorId}`);
        button.addEventListener("click", () => onPlaceableCellClick(sectorId));
        td.appendChild(button);
      } else {
        td.innerHTML = `<span class="visually-hidden">Sector ${sectorId}, empty</span>`;
      }

      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tableEl.appendChild(tbody);
}

/**
 * "Your Ship": the human's private panel (hand, shares, credits, End Turn,
 * End Game). `elements` = { creditsEl, handListEl, sharesListEl,
 * endTurnButtonEl, endGameButtonEl }.
 * `callbacks` = { onHandTileClick(sectorId), onEndTurn(), onEndGame() }.
 */
export function renderYourShip(view, humanId, elements, callbacks) {
  const human = view.players.find((p) => p.id === humanId);
  elements.creditsEl.textContent = human.credits;

  const isPlacingTurn = view.turnPhase === "placingTile" && isCurrentPlayer(view, humanId);
  elements.handListEl.innerHTML = "";
  for (const sectorId of human.hand) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `Sector ${sectorId}`;
    button.disabled = !isPlacingTurn;
    if (isPlacingTurn) {
      button.addEventListener("click", () => callbacks.onHandTileClick(sectorId));
    }
    li.appendChild(button);
    elements.handListEl.appendChild(li);
  }

  const shareEntries = Object.entries(human.shares).filter(([, count]) => count > 0);
  elements.sharesListEl.innerHTML = "";
  if (shareEntries.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No shares held.";
    elements.sharesListEl.appendChild(li);
  } else {
    for (const [corporationId, count] of shareEntries) {
      const li = document.createElement("li");
      li.textContent = `${view.corporations[corporationId].name}: ${count}`;
      elements.sharesListEl.appendChild(li);
    }
  }

  const isBuyingTurn = view.turnPhase === "buyingShares" && isCurrentPlayer(view, humanId);
  elements.endTurnButtonEl.hidden = !isBuyingTurn;
  elements.endTurnButtonEl.onclick = isBuyingTurn ? callbacks.onEndTurn : null;

  // Voluntary end-of-game action (docs/game-engine-api.md's endGame()) —
  // available on the human's turn, in any phase, the moment some
  // corporation reaches 41+ sectors or every active corporation is secure.
  const canEndGame =
    view.turnPhase !== "gameOver" && isCurrentPlayer(view, humanId) && isEndGameAvailable(view);
  elements.endGameButtonEl.hidden = !canEndGame;
  elements.endGameButtonEl.onclick = canEndGame ? callbacks.onEndGame : null;
}

/**
 * The Game Over summary: shown once turnPhase is "gameOver", listing every
 * player's final credit total (endGame()'s finalStandings, already sorted
 * highest-first) — final totals are public information once the game has
 * actually ended, unlike mid-game credits.
 */
export function renderFinalStandings(view, sectionEl, listEl) {
  if (view.turnPhase !== "gameOver") {
    sectionEl.hidden = true;
    return;
  }
  sectionEl.hidden = false;
  listEl.innerHTML = "";
  for (const { name, credits } of view.finalStandings) {
    const li = document.createElement("li");
    li.textContent = `${name} — ${credits} Credits`;
    listEl.appendChild(li);
  }
}

/**
 * The Market: every corporation's public tier/size/secure/price/shares-left,
 * with a Buy button gated by phase, the 3-share cap, bank availability, and
 * affordability — using aria-disabled (not the native attribute) so a
 * screen reader can still discover the button and hear WHY it's inactive,
 * per docs/ui-design.md's pattern.
 * `elements` = { statusEl, tableBodyEl }. `callbacks` = { onBuy(corporationId) }.
 */
export function renderMarket(view, humanId, elements, callbacks) {
  const isBuyingTurn = view.turnPhase === "buyingShares" && isCurrentPlayer(view, humanId);
  const human = view.players.find((p) => p.id === humanId);
  const remainingAllowance = MAX_SHARES_PURCHASED_PER_TURN - view.sharesPurchasedThisTurn;

  elements.statusEl.textContent = isBuyingTurn
    ? `Share purchases this turn: ${view.sharesPurchasedThisTurn} of ${MAX_SHARES_PURCHASED_PER_TURN} used.`
    : "";

  elements.tableBodyEl.innerHTML = "";
  for (const corporation of Object.values(view.corporations)) {
    const tr = document.createElement("tr");
    const cells = [
      corporation.name,
      corporation.tier,
      String(corporation.sectors.size),
      isActive(corporation) ? (isSecure(corporation) ? "Yes" : "No") : "—",
      isActive(corporation) ? String(getPrice(corporation)) : "—",
      String(view.bank.sharesRemaining[corporation.id]),
    ];
    for (const text of cells) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    }

    const buyCell = document.createElement("td");
    if (isActive(corporation)) {
      const price = getPrice(corporation);
      const reasons = [];
      if (!isBuyingTurn) reasons.push("it is not your turn to buy shares");
      if (remainingAllowance <= 0) reasons.push("you have already bought 3 shares this turn");
      if (view.bank.sharesRemaining[corporation.id] <= 0) reasons.push("the bank has none left");
      if (human.credits < price) reasons.push("you cannot afford it");
      const disabled = reasons.length > 0;

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `Buy 1 share of ${corporation.name} — ${price} Credits`;
      button.setAttribute("aria-disabled", String(disabled));
      if (disabled) {
        const reasonId = `buy-reason-${corporation.id}`;
        button.setAttribute("aria-describedby", reasonId);
        const reasonSpan = document.createElement("span");
        reasonSpan.id = reasonId;
        reasonSpan.className = "visually-hidden";
        reasonSpan.textContent = `Cannot buy: ${reasons.join(", ")}.`;
        buyCell.appendChild(reasonSpan);
      } else {
        button.addEventListener("click", () => callbacks.onBuy(corporation.id));
      }
      buyCell.appendChild(button);
    } else {
      buyCell.textContent = "Not founded";
    }
    tr.appendChild(buyCell);

    elements.tableBodyEl.appendChild(tr);
  }
}

/**
 * Rebuilds the setup dialog's AI-opponent rows (one per AI player, i.e.
 * `count - 1` of them) whenever the player-count select changes. Preserves
 * any names/difficulties already entered for rows that still exist, rather
 * than wiping the whole block back to defaults on every count change.
 * Easy and Medium are both real, selectable tiers (js/ai/easy.js,
 * js/ai/medium.js); Hard is shown per docs/ai-design.md's confirmed 3-tier
 * design but stays disabled until the MCTS tier is built.
 */
export function renderSetupAiRows(count, containerEl) {
  const aiCount = count - 1;
  const existingValues = [...containerEl.querySelectorAll(".setup-ai-row")].map((row) => ({
    name: row.querySelector(".setup-ai-name").value,
    difficulty: row.querySelector(".setup-ai-difficulty").value,
  }));

  containerEl.innerHTML = "";
  for (let i = 0; i < aiCount; i += 1) {
    const previous = existingValues[i];
    const row = document.createElement("div");
    row.className = "setup-ai-row";
    row.innerHTML = `
      <label>AI opponent ${i + 1} name
        <input type="text" class="setup-ai-name" value="${previous ? previous.name : `AI Opponent ${i + 1}`}">
      </label>
      <label>Difficulty
        <select class="setup-ai-difficulty">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard" disabled title="Not implemented yet">Hard (coming soon)</option>
        </select>
      </label>
    `;
    row.querySelector(".setup-ai-difficulty").value = previous ? previous.difficulty : "easy";
    containerEl.appendChild(row);
  }
}

// Phase -> contextual hint text + the "How to Play" section id its "Learn
// more" link deep-links to (see js/ui/main.js's openHelpDialog()). Only
// covers phases where the HUMAN might have something to do — an AI's turn
// has nothing to hint about, so renderContextualHint() below hides the
// widget entirely rather than looking one up.
const CONTEXTUAL_HINTS = {
  placingTile: {
    text: "Click a Sector in your hand, or its matching cell on the Star Map, to place it. You'll be asked to confirm before anything happens.",
    sectionId: "help-placing",
  },
  buyingShares: {
    text: "You may buy up to 3 Shares this turn from the Market, or press End Turn to skip.",
    sectionId: "help-buying-shares",
  },
  choosingCorporationToFound: {
    text: "Choose which Corporation to found from the connected Sectors you just placed.",
    sectionId: "help-founding",
  },
  choosingMergerSurvivor: {
    text: "Two or more Corporations are tied for largest — choose which one survives the merger.",
    sectionId: "help-mergers",
  },
  resolvingMerger: {
    text: "Decide how many of your Shares in the absorbed Corporation to sell, trade, or hold.",
    sectionId: "help-mergers",
  },
};

/**
 * Updates the contextual hint's text only — deliberately never touches the
 * <details> element's `open` attribute, so a hint the player has manually
 * expanded stays expanded across a phase change (docs/help-design.md).
 * Hidden entirely when there's no game yet, the game is over, or it isn't
 * the human's turn (nothing for them to do right now).
 * `elements` = { detailsEl, textEl }.
 */
export function renderContextualHint(view, humanId, elements) {
  const hint = CONTEXTUAL_HINTS[view.turnPhase];
  const isHumansTurn = isCurrentPlayer(view, humanId);

  if (!hint || !isHumansTurn) {
    elements.detailsEl.hidden = true;
    return;
  }

  elements.detailsEl.hidden = false;
  elements.textEl.innerHTML =
    `${hint.text} ` +
    `<button type="button" class="link-button" data-help-section="${hint.sectionId}">Learn more</button>`;
}

/** The public Event Log — also feeds an aria-live region (see index.html). */
export function renderEventLog(view, listEl) {
  listEl.innerHTML = "";
  for (const entry of view.eventLog) {
    const li = document.createElement("li");
    li.textContent = entry.message;
    listEl.appendChild(li);
  }
  listEl.scrollTop = listEl.scrollHeight;
}

/**
 * The "choosingCorporationToFound" dialog: one button per still-available
 * corporation name. `elements` = { messageEl, listEl }. Clicking a button
 * *is* the confirm action — mirrors the Market's Buy buttons rather than
 * adding a separate Confirm step for a single choice.
 */
export function renderFoundingDialog(gameState, elements, onChoose) {
  elements.messageEl.textContent = "Choose a corporation to found:";
  elements.listEl.innerHTML = "";
  for (const corporation of getAvailableCorporations(gameState.corporations)) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${corporation.name} (${corporation.tier})`;
    button.addEventListener("click", () => onChoose(corporation.id));
    li.appendChild(button);
    elements.listEl.appendChild(li);
  }
}

/**
 * The "choosingMergerSurvivor" dialog: one button per corporation tied for
 * largest. `elements` = { messageEl, listEl }.
 */
export function renderMergerSurvivorDialog(gameState, elements, onChoose) {
  const { candidateSurvivorIds, corporationIds } = gameState.pendingMerger;
  const names = corporationIds.map((id) => gameState.corporations[id].name).join(" and ");
  elements.messageEl.textContent = `Merging ${names}. Choose which corporation survives:`;

  elements.listEl.innerHTML = "";
  for (const corporationId of candidateSurvivorIds) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = gameState.corporations[corporationId].name;
    button.addEventListener("click", () => onChoose(corporationId));
    li.appendChild(button);
    elements.listEl.appendChild(li);
  }
}

/**
 * The "resolvingMerger" share-disposition dialog: sell/trade/hold inputs
 * that must sum to the shareholder's full holding, with live validation
 * (both the arithmetic and the trade-pair/bank-availability rules that
 * js/model/game.js's decideShareDisposition() itself enforces — checking
 * them here too means the player finds out about a mistake immediately,
 * rather than via a thrown error). Defaults to "sell everything", so
 * confirming immediately without changing anything is always a valid
 * one-click action.
 * `elements` = { messageEl, sellInput, tradeInput, holdInput, validationEl, confirmButton }.
 * `onConfirm` receives the validated { sell, trade, hold } object.
 */
export function renderShareDispositionDialog(gameState, decision, elements, onConfirm) {
  const player = gameState.players.find((p) => p.id === decision.playerId);
  const corporation = gameState.corporations[decision.corporationId];
  const shareCount = player.shares[decision.corporationId] ?? 0;
  const survivor = gameState.corporations[gameState.pendingMerger.survivorId];

  elements.messageEl.textContent =
    `${player.name} holds ${shareCount} share(s) of ${corporation.name}, being absorbed into ` +
    `${survivor.name}. Decide how many to sell, trade (2-for-1 into ${survivor.name}), or hold.`;

  elements.sellInput.value = String(shareCount);
  elements.tradeInput.value = "0";
  elements.holdInput.value = "0";

  function validate() {
    const sell = Number(elements.sellInput.value) || 0;
    const trade = Number(elements.tradeInput.value) || 0;
    const hold = Number(elements.holdInput.value) || 0;
    const reasons = [];

    if (sell + trade + hold !== shareCount) {
      reasons.push(`sell + trade + hold must add up to ${shareCount}`);
    }
    if (trade % 2 !== 0) {
      reasons.push("trade must be an even number (2 shares per 1 new share)");
    }
    const survivorSharesNeeded = Math.floor(trade / 2);
    if (survivorSharesNeeded > gameState.bank.sharesRemaining[survivor.id]) {
      reasons.push(`the bank only has ${gameState.bank.sharesRemaining[survivor.id]} ${survivor.name} shares left`);
    }

    const valid = reasons.length === 0;
    elements.validationEl.textContent = valid ? "" : `Cannot confirm: ${reasons.join("; ")}.`;
    elements.confirmButton.setAttribute("aria-disabled", String(!valid));
    return valid ? { sell, trade, hold } : null;
  }

  elements.sellInput.oninput = validate;
  elements.tradeInput.oninput = validate;
  elements.holdInput.oninput = validate;
  elements.confirmButton.onclick = () => {
    const decisionValues = validate();
    if (decisionValues) onConfirm(decisionValues);
  };

  validate();
}
