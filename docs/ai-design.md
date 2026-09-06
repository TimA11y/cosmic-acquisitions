# AI design

This describes how AI-controlled players work in Project X, built entirely in vanilla JS (R3) — no AI/game-tree libraries, since a generic library would only provide the tree-search bookkeeping while all the game-specific logic (legal moves, hidden-hand handling, evaluation) still has to be written by us regardless.

## Setup

The number of total players is configurable (2–6, matching the original game), with exactly one human player and the rest AI-controlled. Each AI player has its own `difficulty` field (`"easy" | "medium" | "hard"`), chosen independently per opponent at game setup — so a game can mix, e.g., one easy and one hard AI.

Every AI decision function is only ever given `getViewFor(gameState, aiPlayerId)` (see `docs/data-model.md`/`docs/game-engine-api.md`) — never the raw `gameState`. This is the same architectural rule that protects the human player's private info from the AI, applied symmetrically: the AI can't "cheat" by reasoning over opponents' hidden hands either.

## Difficulty tiers

### Easy — random legal moves

- **Placement**: uniformly random pick from `getLegalPlacements()`.
- **Founding a corporation / choosing a merger survivor**: uniformly random among the legal options.
- **Share disposition** (sell/trade/hold during a merger): fixed rule — sell everything. No judgment needed at this tier.
- **Buying shares**: randomly decides to buy 0–3 shares among whatever it can currently afford.

This is the cheapest tier to build and a reasonable baseline opponent — worth implementing first since it exercises the full turn state machine without needing any evaluation logic.

### Medium — one-ply heuristic scoring

For each legal placement, score it along a few concrete dimensions (exact weights are a tuning detail decided during implementation, not fixed here):
- Does it grow a corporation the AI already holds significant shares in?
- Does it push one of the AI's corporations toward secure (11+ sectors)?
- Does a triggered merger pay the AI a majority/minority bonus (favor these; avoid mergers that mainly benefit the human)?
- Does founding let the AI claim the founder's free share?

Pick the highest-scoring legal move. The same scoring approach applies to share purchases — prefer consolidating existing positions or buying into safe/growing corporations. No lookahead beyond the immediate move (hence "one-ply").

### Hard — determinized Monte Carlo Tree Search (MCTS)

Since the AI can't see opponents' hands, at decision time it:
1. **Samples a plausible hidden state** — randomly deals out unseen tiles across the bank's sector pool and opponents' hands, consistent with what's public (each opponent's hand size, the pool's remaining count).
2. **Runs simulated playouts** from that guessed-complete state, reusing the existing pure state-transition functions directly (`placeTile`, `buyShares`, etc.) — a direct payoff of having built the game engine as pure functions in `docs/game-engine-api.md`.
3. **Selects moves during simulation via UCB1** (the standard MCTS selection formula balancing exploration vs. exploitation).
4. **Repeats with several different random hidden-state guesses** (multiple determinizations), rather than trusting a single guess, to avoid overfitting to one possible arrangement of hidden tiles.

The move with the best average simulated outcome (evaluated via credits + share value, since simulating every game fully to completion every time may be too slow) is chosen.

## Implementation notes

- **AI "thinking" UX**: the header's turn-status live region (see `docs/ui-design.md`) shows e.g. *"Kestrel Mining AI is thinking…"* during AI turns, with a small minimum delay (~500ms) even for instant easy/medium decisions, so turns don't resolve too fast to follow.
- **Don't block the main thread for hard-tier MCTS**: many simulations run synchronously could freeze the tab. Two options to weigh during implementation: yield periodically between simulation batches (`setTimeout`/`requestIdleCallback`), or run the search in a **Web Worker** (a native browser API, not a library — doesn't conflict with R3). A Web Worker would also incidentally strengthen the hidden-information architecture noted as a future option in `docs/data-model.md`, since the worker's memory wouldn't be directly visible from the main thread's devtools. Deferring the exact choice until implementation, when real performance can be measured.

## Open questions for the next design step

- Exact heuristic weights for the medium tier, and simulation count/time budget for the hard tier — both are empirical tuning decisions best made once there's a working game loop to test against.
- Whether difficulty can be changed mid-game or is fixed for the whole session (default assumption: fixed per game).
