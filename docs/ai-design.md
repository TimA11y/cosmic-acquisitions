# AI design

This describes how AI-controlled players work in Cosmic Acquisitions, built entirely in vanilla JS (R3) — no AI/game-tree libraries, since a generic library would only provide the tree-search bookkeeping while all the game-specific logic (legal moves, hidden-hand handling, evaluation) still has to be written by us regardless.

## Setup

The number of total players is configurable (2–6, matching the original game), with exactly one human player and the rest AI-controlled. Each AI player has its own `difficulty` field (`"easy" | "medium" | "hard"`), chosen independently per opponent at game setup — so a game can mix, e.g., one easy and one hard AI.

Every AI decision function is only ever given `getViewFor(gameState, aiPlayerId)` (see `docs/data-model.md`/`docs/game-engine-api.md`) — never the raw `gameState`. This is the same architectural rule that protects the human player's private info from the AI, applied symmetrically: the AI can't "cheat" by reasoning over opponents' hand contents or the bank's true draw order, neither of which is ever knowable. As of the hard tier's build (2026-09-06), `getViewFor()` DOES expose every player's `shares`/`credits` — those turned out to be public-in-effect (every change is event-logged, and starting credits are known), not hidden information; see `docs/data-model.md`'s revised "Public vs. private information" section.

## Difficulty tiers

### Easy — random legal moves

- **Placement**: uniformly random pick from `getLegalPlacements()`.
- **Founding a corporation / choosing a merger survivor**: uniformly random among the legal options.
- **Share disposition** (sell/trade/hold during a merger): fixed rule — sell everything. No judgment needed at this tier.
- **Buying shares**: randomly decides to buy 0–3 shares among whatever it can currently afford.

This is the cheapest tier to build and a reasonable baseline opponent — worth implementing first since it exercises the full turn state machine without needing any evaluation logic.

### Medium — one-ply heuristic scoring (implemented 2026-09-06, `js/ai/medium.js`)

For each legal placement, score it along a few concrete dimensions:
- Does it grow a corporation the AI already holds significant shares in?
- Does it push one of the AI's corporations toward secure (11+ sectors)?
- Does a triggered merger pay the AI a majority/minority bonus (favor these; avoid mergers that mainly benefit the human)?
- Does founding let the AI claim the founder's free share?

Pick the highest-scoring legal move. The same scoring approach applies to share purchases — prefer consolidating existing positions or buying into safe/growing corporations. No lookahead beyond the immediate move (hence "one-ply").

**Chosen weights** (the "empirical tuning" this doc originally left open — see "Open questions" below): founding scores a flat `5` (a free share is close to a sure thing); growing a held corporation scores `2 + ownShares * 1.5`, plus `2 + ownShares` more if the growth newly crosses the secure threshold; a merger scores `1 + Σ(ownShares in each involved corporation) * 1.5`; an isolated placement scores a baseline `1`. Share purchases score each affordable corporation by `ownShares * 2 + (isSecure ? 3 : 0)` and buy the top scorer up to the per-turn/bank/affordability limit, with no random skipping (unlike easy) — a deliberate tier buys when there's a reasonable candidate. Merger-survivor ties and founding-name choices both prefer the option that best serves the AI's existing position (most-held tied corporation; highest-tier available name). Merger share disposition trades into the survivor when the bank can support a full even split AND the survivor looks like a good hold (secure, or bigger than what's being absorbed), otherwise falls back to easy's sell-everything rule.

**A constraint that shaped medium (and still limits it, by choice)**: even though opponents' shares are now visible in the view (see above), medium's scoring functions only ever weigh the acting AI's OWN shares — "avoid mergers that mainly benefit the human" is still approximated as "favor moves that build my own position," not a real relative-holdings comparison. That's a one-ply-heuristic scope choice, not an information limit anymore.

### Hard — determinized Monte Carlo Tree Search (implemented 2026-09-06, `js/ai/hard.js`)

Only the **placement** decision gets real tree search; founding, merger-survivor ties, share disposition, and share buying all re-export medium's existing heuristics unchanged. Building bespoke simulation-based logic for every decision type would be a much larger undertaking for comparatively little benefit — real MCTS game AIs commonly make the same call (tree-search the decision that matters most, use a fast heuristic/random policy elsewhere).

For the placement decision, at decision time it:
1. **Samples a plausible hidden state** (`determinizeHiddenState`) — since opponents' `shares`/`credits` are now exactly known (see above), the ONLY thing that needs sampling is hand *contents*: the unseen sectors (not on the board, not in the AI's own hand) are shuffled and dealt to opponents' hands (matching each one's real, public `handSize`), with the remainder becoming the sampled bank pool.
2. **Runs simulated playouts** from that guessed-complete state, reusing the existing pure state-transition functions directly (`placeTile`, `foundCorporation`, `chooseMergerSurvivor`, `decideShareDisposition`, `drawTile`) — a direct payoff of having built the game engine as pure functions.
3. **Selects the ROOT placement via UCB1** (the standard MCTS selection formula balancing exploration vs. exploitation) — unvisited candidates are always tried first. This is root-level UCB1 only, not a full multi-ply tree covering every rules branch at every future decision point for every player, which would be intractable given this game's branching factor. Everything beyond the root move within one simulated line — founding choices, merger ties, every other player's moves, the root AI's own subsequent moves — plays out via fast, uniformly-random legal moves (the same fixed rules easy tier uses; share buying is skipped during rollout for speed), capped at a small number of further turns (`MAX_ROLLOUT_PLIES = 6`).
4. **Repeats across `DETERMINIZATION_COUNT = 5` different random hidden-state guesses**, rather than trusting a single guess, to avoid overfitting to one possible arrangement of hidden tiles — stats are pooled across all of them before picking a winner.

The move with the best average simulated outcome — `(credits + Σ(shares × price)) / STARTING_CREDITS`, normalized so UCB1's exploration term is on a comparable scale to the value estimates — is chosen. Skips the search entirely (no decision to make) when zero or one placement is legal.

## Implementation notes

- **AI "thinking" UX**: the header's turn-status live region (see `docs/ui-design.md`) shows e.g. *"Kestrel Mining AI is thinking…"* during AI turns, with a small minimum delay (~500ms) even for instant easy/medium decisions, so turns don't resolve too fast to follow.
- **Main-thread blocking, resolved**: a **time-boxed loop with periodic yielding** was chosen over a Web Worker. `TOTAL_TIME_BUDGET_MS = 400` is split across the 5 determinizations; every `ROLLOUTS_PER_YIELD = 8` rollouts, the loop `await`s a `setTimeout(resolve, 0)` so the browser can repaint/respond. A wall-clock budget (not a fixed simulation count) adapts automatically to whatever hardware it runs on. This was the simpler of the two options: hard's `choosePlacementAction()` is the only function in the entire AI call graph that needed to become `async` — every other decision point re-exports medium's synchronous heuristics — so `js/ui/main.js`'s turn driver only needed one `await` added (`runAiTurn()`), not the message-passing/serialization architecture a Web Worker would have required.

## Open questions for the next design step

- Whether difficulty can be changed mid-game or is fixed for the whole session (default assumption: fixed per game) — still true; `js/ui/main.js`'s `aiDifficulties` map is only ever populated at setup time.
- Hard's simulation budget (400ms / 5 determinizations / 6-ply rollouts) is a first pass, not empirically tuned against real play — a reasonable next step if the tier feels too weak or turns feel too slow in practice.
