# Save/resume design

Full game persistence to `localStorage` — no backend, consistent with the vanilla-JS/no-framework requirement (R3).

## Storage & save points

A single save slot, key `"projectx-save"` — one slot is enough since this is a local, single-human-vs-AI game with no accounts or multiple concurrent games to track. The game auto-saves after every `drawTile()` call, the natural end-of-turn checkpoint: `turnPhase` is always cleanly back to `"placingTile"` for the next player at that point, never mid-decision. A browser crash or tab close mid-turn loses only that in-progress turn, not the whole game — an accepted tradeoff for not having to checkpoint every intermediate state.

## Load flow

On page load, check for an existing save in `localStorage`. If one exists, show an accessible native `<dialog>` prompting **"Resume Game"** or **"New Game"** (matching the same `<dialog>` pattern used throughout `docs/ui-design.md`). Choosing "New Game" clears the existing save before starting fresh. A **"New Game"** option is also reachable during play (e.g. from the header), for a player who wants to intentionally abandon their current save.

## Serialization

A new file, **`js/model/persistence.js`**, exports `serialize(gameState)` and `deserialize(json)`. Most of `gameState` — `players`, `bank`, `eventLog`, `turnPhase`, `pendingFounding`, `pendingMerger`, `sharesPurchasedThisTurn`, `currentPlayerIndex` — is already plain data that `JSON.stringify`/`JSON.parse` handle natively. Two fields need explicit conversion, since `Map` and `Set` don't survive JSON round-tripping:

- **`board`** (a `Map<sectorId, {corporationId}>`): `Object.fromEntries(board)` to serialize, `new Map(Object.entries(obj))` to restore.
- **Each corporation's `sectors`** (a `Set<sectorId>`): `[...sectors]` to serialize, `new Set(array)` to restore.

## Resilience

If a `localStorage` write fails (quota exceeded, or restrictions in some browsers' private/incognito modes), the game continues normally in memory without persistence rather than erroring out — saving is a convenience layered on top of gameplay, not something gameplay depends on.

## Open questions for the next design step

None remaining. Both are resolved:

- **Resume/New Game dialog copy**: `#resume-dialog` ("A saved game was found." with "Start New Game"/"Resume Game" buttons) and `#confirm-new-game-dialog` ("Start a new game? Your current progress will be lost." with "Cancel"/"Start New Game" buttons) in `index.html`.
- **Save schema versioning**: `js/model/persistence.js` stamps a `SCHEMA_VERSION` (currently `1`); `deserialize()` throws on mismatch, which `js/ui/storage.js` treats as "no save."
