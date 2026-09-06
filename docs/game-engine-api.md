# Game engine API (function signatures)

This defines the function surface that operates on the `gameState` shape described in `docs/data-model.md`. Every function here is **pure**: it takes state in and returns a new state out (or, for the read-only helpers, returns a computed value) with no hidden dependencies and no DOM access. That's what makes it possible to test the entire rules engine with Cucumber/BDD scenarios (see `requirements.md` R8) without touching the UI at all.

## Turn state machine

Placing a tile can trigger follow-up decisions before a turn can move on to buying shares, so `turnPhase` has more states than the original data-model sketch:

```
placingTile
  |
  |-- (plain growth / isolated tile) --------------------> buyingShares
  |
  |-- (founds a corp, >1 name still unused) --> choosingCorporationToFound --> buyingShares
  |
  |-- (merger, tie for largest) --> choosingMergerSurvivor --> resolvingMerger --> buyingShares
  |
  \-- (merger, no tie) ------------------------------------> resolvingMerger --> buyingShares

buyingShares --> drawingTile --> (next player) placingTile
```

`choosingCorporationToFound` and `choosingMergerSurvivor` are skipped automatically when there's only one legal choice (one unused corporation name; an outright-largest survivor). `gameState` gains two transient fields to support this: `pendingFounding` (the sector ids waiting to be assigned to a chosen corporation) and `pendingMerger` (survivor candidates, then the queue of shareholder decisions still outstanding), both `null` outside of their respective phases.

## Pure helpers (read-only)

```js
/**
 * True if placing this sector would be illegal right now — either because it
 * would force a merger between two corporations that are both already secure
 * (11+ sectors, which the rules forbid), or because it would found a new
 * corporation but all 7 corporation names are already active on the board.
 */
function isDeadTile(gameState, sectorId) { ... }

/**
 * Sector ids from a player's hand that are legal to place right now. This is
 * the single source of truth for "what moves are legal" — used by the UI to
 * grey out / skip dead tiles, and by the AI to enumerate its options, so the
 * two never disagree about legality.
 */
function getLegalPlacements(gameState, playerId) { ... }

/**
 * Describes what a (legal) placement would do, without applying it:
 *   { effect: "none" | "grow" | "found" | "merger", ...details }
 * Lets the UI show a preview before commit, and lets placeTile() decide which
 * follow-up phase to enter next.
 */
function analyzePlacement(gameState, sectorId) { ... }

/**
 * True if any corporation has 41+ sectors, or every active corporation is
 * secure — the two conditions that make ending the game an available choice.
 */
function isEndGameAvailable(gameState) { ... }

/**
 * Redacted copy of gameState for a given player: public fields unchanged,
 * that player's own hand/shares/credits included in full, every other
 * player's private fields reduced to counts only (e.g. handSize instead of
 * hand). This is the ONLY view the UI and the AI are allowed to read from —
 * see docs/data-model.md's "Public vs. private information" section.
 */
function getViewFor(gameState, playerId) { ... }
```

## State-transition functions

```js
/**
 * Moves a tile from the player's hand onto the board. Based on what
 * analyzePlacement() reports, advances turnPhase to one of:
 *   "choosingCorporationToFound" — founds a new corp, >1 corporation name
 *       still unused (player must pick which)
 *   "choosingMergerSurvivor"     — merges 2+ corps, tie for largest
 *       (player must pick which one survives)
 *   "resolvingMerger"            — merges 2+ corps, no tie (survivor is
 *       automatic; shareholders still need to decide sell/trade/hold)
 *   "buyingShares"               — plain growth or an isolated tile;
 *       nothing further to decide before buying shares
 * Throws if sectorId is a dead tile — callers must check isDeadTile() (or
 * filter through getLegalPlacements()) before calling this.
 */
function placeTile(gameState, playerId, sectorId) { ... }

/**
 * Used when turnPhase is "choosingCorporationToFound". Assigns the sectors
 * in gameState.pendingFounding to the chosen corporation, grants the
 * founder's free share (if the bank has one available), clears
 * pendingFounding, advances to "buyingShares".
 */
function foundCorporation(gameState, corporationId) { ... }

/**
 * Used when turnPhase is "choosingMergerSurvivor". Records which corporation
 * survives the merger, builds the queue of shareholder decisions needed
 * (every player holding shares in an absorbed corp) into
 * gameState.pendingMerger, advances to "resolvingMerger".
 */
function chooseMergerSurvivor(gameState, corporationId) { ... }

/**
 * Used once per shareholder per absorbed corporation while turnPhase is
 * "resolvingMerger". decision = { sell: n, trade: n, hold: n }; the three
 * numbers must add up to that player's share count in the absorbed corp.
 * Applies the majority/minority cash bonus automatically the first time a
 * given absorbed corp is processed. Once every pending decision for every
 * absorbed corp is resolved: merges their sectors into the survivor (which
 * frees the absorbed corp's name for future founding, since it returns to
 * zero sectors), clears pendingMerger, advances to "buyingShares".
 */
function decideShareDisposition(gameState, playerId, corporationId, decision) { ... }

/**
 * Buys `quantity` shares (default 1) of one corporation, committing
 * immediately. Validates against the per-turn cap of 3 total shares
 * (tracked in gameState.sharesPurchasedThisTurn, reset to 0 on entering
 * "buyingShares"), bank availability (bank.sharesRemaining), and the
 * player's credits. Does NOT advance turnPhase — the player may call this
 * multiple times while remaining in "buyingShares", until they choose to
 * end the phase by calling drawTile().
 */
function buyShares(gameState, playerId, corporationId, quantity = 1) { ... }

/**
 * Refills the acting player's hand back up to 6 sectors from the bank's
 * sector pool, appends a turn-summary event to gameState.eventLog, advances
 * currentPlayerIndex to the next player, resets turnPhase to "placingTile".
 */
function drawTile(gameState, playerId) { ... }

/**
 * Implements the "prove it's dead, discard, redraw" rule: validates that
 * isDeadTile(gameState, sectorId) is true for a tile in the player's hand,
 * swaps it for a fresh draw from the bank's sector pool. Does not consume
 * the player's turn or change turnPhase.
 */
function exchangeDeadTile(gameState, playerId, sectorId) { ... }

/**
 * Voluntary end-of-game action, only callable when isEndGameAvailable(gameState)
 * is true. Liquidates every active corporation in turn (majority/minority
 * bonuses paid out exactly as in a merger), then converts every player's
 * remaining shares to credits at each corporation's current price. Sets
 * turnPhase to "gameOver" with final per-player credit totals recorded for
 * determining the winner.
 */
function endGame(gameState, playerId) { ... }
```

## Why this shape

- **One function per rules decision point** means each maps close to one-to-one onto a BDD scenario (e.g. "Given two corporations are each 10 sectors, When a tile connects them, Then the player is asked to choose the surviving corporation" exercises exactly `placeTile` → `chooseMergerSurvivor`).
- **Pure functions returning new state** (rather than mutating in place) make it trivial to test — call the function, assert on what came back, no setup/teardown of shared mutable state between test scenarios.
- **`getLegalPlacements` and `isDeadTile` as shared helpers** mean the UI (to grey out illegal tiles) and the AI (to enumerate its options) can never disagree about what's legal, since they call the same code.

## Open questions for the next design step

- File layout under `js/model/` — likely one file per concern (`board.js`, `corporations.js`, `players.js`, `bank.js`, `merger.js`, `game.js`) plus an `index.js` or similar that re-exports the public API.
- Exact event types/messages recorded to `eventLog` for each transition.
