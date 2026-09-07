# Data model

This describes the core game-state shape for Cosmic Acquisitions. It's plain JS data (objects, arrays, Maps, Sets) plus **pure functions** that read and return state — no classes, no framework, matching the vanilla-JS requirement (see `requirements.md` R3). Pure functions (taking state in, returning new/updated state out, no hidden dependencies) make the model straightforward to test with BDD scenarios independent of any UI or DOM.

## Sector coordinates

Sectors are identified by a string coordinate like `"6-B"` — column 1–12, row A–I, the same 12×9 grid layout as the original game (see `docs`/base-game research in project history). This format is deliberately kept close to the original because it's an established, easily-scannable convention (like chess coordinates).

## Board

```js
// Map<sectorId, { corporationId: string | null }>
// corporationId is null until the sector becomes part of a corporation
const board = new Map([
  ["6-B", { corporationId: "novaTraders" }],
  ["7-B", { corporationId: "novaTraders" }],
  ["1-A", { corporationId: null }],   // placed, but not yet part of any corporation
  // sectors not yet placed simply have no entry in the map
]);
```

## Corporation

One entry per corporation (the 7 named in `requirements.md`'s space theme glossary).

```js
{
  id: "novaTraders",
  name: "Nova Traders",
  tier: "economy",              // "economy" | "standard" | "luxury"
  sectors: new Set(["6-B", "7-B"]),  // tile count = sectors.size
}
```

`isSecure` (tile count >= 11) and current share price are **derived**, not stored — computed on demand from `sectors.size` and `tier`, via lookup against the price chart. Storing them separately would risk them drifting out of sync with the actual sector count; deriving them means that can't happen.

## Player

```js
{
  id: "player-1",
  name: "You",
  isHuman: true,
  hand: ["6-B", "9-F", "2-A", "11-I", "4-D", "8-C"],  // PRIVATE: 6 sector ids
  shares: { novaTraders: 3, orionFreight: 1 },        // PRIVATE: count per corporation (omitted keys = 0)
  credits: 6000,                                       // PRIVATE
}
```

## Bank

```js
{
  sectorPool: [ /* remaining sector ids not yet drawn, order = draw order */ ],
  sharesRemaining: { novaTraders: 22, kestrelMining: 25, /* ... */ },  // PUBLIC
}
```

The bank's `sectorPool` contents are secret (nobody knows what's left to draw), but its **length** is public information (players can always see how many sectors remain in the pool).

## GameState

The top-level object:

```js
{
  board,             // as above
  corporations: {    // keyed by corporation id
    novaTraders: { /* ... */ },
    kestrelMining: { /* ... */ },
    // ...
  },
  players: [ /* Player objects, in turn order */ ],
  bank,              // as above
  currentPlayerIndex: 0,
  // Full state machine (see docs/game-engine-api.md for the functions that drive it):
  //   placingTile -> [choosingCorporationToFound | choosingMergerSurvivor] -> resolvingMerger -> buyingShares -> drawingTile -> (next player) placingTile
  // The two bracketed phases are skipped automatically when there's only one legal choice.
  turnPhase: "placingTile",
  eventLog: [
    { type: "sharesPurchased", message: "Player 2 bought 2 shares of Orion Freight.", turnNumber: 5 },
    // message strings are written to be screen-reader-friendly,
    // so the same log feeds both a visible panel and an ARIA live region
  ],
  pendingFounding: null,  // populated during "choosingCorporationToFound" with the sector ids awaiting assignment
  pendingMerger: null,    // populated during "choosingMergerSurvivor"/"resolvingMerger" with { survivorId, absorbedIds, shareholderDecisions: {...} }
  sharesPurchasedThisTurn: 0,  // reset to 0 whenever turnPhase becomes "buyingShares"; capped at 3 (see buyShares() in docs/game-engine-api.md)
}
```

## Public vs. private information

Revised 2026-09-06 while building the hard AI tier: the only thing in this model that's genuinely undiscoverable is **hand contents** (which specific tiles a player holds) and the **bank's sector pool order** (which tile comes next). Everything else — including each player's cumulative `shares` and `credits` — turns out to be public *in effect*, even though it isn't displayed as a running total anywhere: every purchase, founder's free share, merger bonus, and sell/trade/hold split is announced via the event log, and starting credits are public knowledge, so a perfect-memory observer could reconstruct exact totals for any player from public information alone. Treating those totals as "private" was an oversimplification of the original design; `getViewFor()` no longer hides them.

**Important limitation:** this is a single browser tab with no server — there's no real process boundary, so even hand contents aren't cryptographically secret; a player could inspect the AI's hand via devtools. What we enforce instead is **architectural discipline**:

- `getViewFor(gameState, playerId)` returns a redacted copy of `gameState`: all public fields unchanged (now including every player's `shares`/`credits`, per the above), the requesting player's own `hand` included in full, and every other player's `hand` replaced with just `handSize`. `bank.sectorPool` is likewise replaced with `bank.sectorPoolSize` — its contents are the other thing that's genuinely hidden, not just undisplayed.
- The human-facing UI renders **only** through `getViewFor` — never the raw `gameState`.
- AI move-selection logic is only ever given `getViewFor(gameState, aiPlayerId)` — never the raw state. This keeps the AI honest (it can't reason over hand contents or the real draw order, which it wouldn't legitimately know) even though nothing stops a determined player from reading memory directly.

If true hidden-information enforcement ever became important, the stronger option would be running AI logic inside a Web Worker for real memory isolation from the main thread. Not needed for this project's scope (single human vs. local AI), but noted here as the escalation path if requirements change.

## Serialization note

`board`'s `Map` and each corporation's `sectors` `Set` don't survive `JSON.stringify`/`JSON.parse` directly — see `docs/persistence-design.md` for the `serialize()`/`deserialize()` conversion used for save/resume.

## See also

`docs/game-engine-api.md` — the pure functions that read and transition this state (`placeTile`, `foundCorporation`, `chooseMergerSurvivor`, `decideShareDisposition`, `buyShares`, `drawTile`, `exchangeDeadTile`, `endGame`, and read-only helpers), plus the full `turnPhase` state machine.

`docs/persistence-design.md` — save/resume via `localStorage`, and how this state shape serializes.
