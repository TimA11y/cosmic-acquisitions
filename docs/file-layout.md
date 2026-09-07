# File layout: `js/model/`

This splits the pure functions from `docs/game-engine-api.md` across files by concern, using native ES modules (`import`/`export`) — no bundler needed, since modern browsers run `<script type="module">` directly, fitting the vanilla-JS requirement (R3).

## Files

- **`js/model/constants.js`** — the fixed rules data: the 7 corporations (id/name/tier, per the space theme glossary in `requirements.md`), the price chart, board dimensions (12×9), starting credits (6000), hand size (6), share cap (25), secure threshold (11), endgame threshold (41).
- **`js/model/board.js`** — low-level board operations: get/set a sector, coordinate parsing (`"6-B"` → column/row) and formatting, neighbor lookup. Used by everything else that needs to reason about adjacency.
- **`js/model/corporations.js`** — corporation-specific helpers: creating the initial 7 (from `constants.js`), price lookup by size/tier, `isSecure()`.
- **`js/model/players.js`** — player creation and hand/shares/credits manipulation (add/remove from hand, add/remove shares, adjust credits).
- **`js/model/bank.js`** — sector pool creation/shuffling/drawing, `sharesRemaining` tracking.
- **`js/model/merger.js`** — merger-specific logic: finding the largest chain(s) and detecting ties, calculating majority/minority bonuses (the 60/30 split and its tie-handling rules), building the shareholder-decision queue.
- **`js/model/placement.js`** — `analyzePlacement()`, `isDeadTile()`, `getLegalPlacements()` — placement legality and outcome analysis, built on `board.js` + `corporations.js`.
- **`js/model/game.js`** — the actual state-transition functions defined in `docs/game-engine-api.md`: `placeTile`, `foundCorporation`, `chooseMergerSurvivor`, `decideShareDisposition`, `buyShares`, `drawTile`, `exchangeDeadTile`, `endGame`, `isEndGameAvailable`, `getViewFor`. This is the orchestration layer that composes every file above it.
- **`js/model/persistence.js`** — `serialize(gameState)`/`deserialize(json)` for save/resume (see `docs/persistence-design.md`), handling the `Map`/`Set` conversions that `board` and each corporation's `sectors` need.
- **`js/model/index.js`** — re-exports `game.js`'s public functions, `persistence.js`'s `serialize`/`deserialize`, plus any constants UI/AI code needs, so consumers (`js/ui/`, `js/ai/`) have one clean import path and never need to reach into the individual concern files directly.

## Dependency direction

`constants.js` depends on nothing. `board.js`, `corporations.js`, `players.js`, and `bank.js` depend only on `constants.js`. `merger.js` and `placement.js` depend on those. `game.js` depends on all of the above. `persistence.js` depends only on the `gameState` shape itself (no logic dependency on `game.js`). `index.js` depends on `game.js` and `persistence.js`. Nothing outside `js/model/` should import from anything but `index.js` — this keeps the internal split free to change later without breaking UI or AI code.

## Testing implication

Since `requirements.md` R8 commits to running *all* BDD scenarios as real Playwright browser sessions (not a separate Node-only unit-test path), even pure rule-engine scenarios (e.g. "Given two corporations are each 10 sectors, when a tile connects them, then the player is asked to choose the surviving corporation") need to exercise these modules as they run inside an actual browser page. The likely approach: a minimal test-harness HTML page that loads `js/model/index.js` as a module and exposes its functions for the test to call through Playwright's `page.evaluate()`, rather than `require`-ing the files directly in Node.

## Open questions for the next design step

None remaining. Both are resolved:

- **`js/ui/`/`js/ai/` file layout**: decided incrementally during implementation, not given a dedicated pass — `js/ui/` ended up as `main.js`/`render.js`/`storage.js`, `js/ai/` as `index.js`/`easy.js`/`medium.js`/`hard.js`.
- **Test-harness page shape**: `test/model-harness.html` is exactly as predicted above — a minimal page whose only job is loading `js/model/index.js` as a real `<script type="module">` and exposing it as `window.CosmicModel` for Playwright's `page.evaluate()` to call through.
