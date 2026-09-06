# Requirements

Itemized requirements for Project X, gathered during requirements discussions. This file is updated as new requirements are added or existing ones are clarified. Each item notes the date it was established.

## Game concept

- **R1** — The game is a turn-based, space-themed variant of Sid Sackson's board game *Acquire*. (2026-09-05)
- **R2** — Single human player competes against one or more AI-controlled players (not hotseat multiplayer between humans). (2026-09-05)

## Technology

- **R3** — The shipped/runtime application must be **vanilla JavaScript, HTML, and CSS only** — no frameworks (e.g. no React), no bundler, no build step. It must run by loading static files directly in a browser. (2026-09-05)
- **R4** — Node.js/npm may be used for **dev-only tooling** (linting, validation, testing). None of this tooling is required to run the shipped game. (2026-09-05)
- **R5** — JavaScript must be linted (tool: ESLint). (2026-09-05)
- **R6** — HTML must be validated (tool: html-validate). (2026-09-05)
- **R7** — CSS must be linted/validated (tool: Stylelint). (2026-09-05)
- **R8** — Automated tests must be written using **BDD** with **Cucumber.js + playwright-bdd** (Gherkin `.feature` files executed as real Playwright browser sessions). (2026-09-05)
- **R9** — Accessibility testing must use **axe-core**, specifically `@axe-core/playwright`, run within the Playwright/BDD browser sessions. (2026-09-05)

## Accessibility

- **R10** — The UI must be fully accessible to screen reader users (semantic HTML, ARIA roles/live-regions, and non-visual perception of game state changes considered from the start). (2026-09-05)
- **R11** — The UI must conform to **WCAG 2.2 Level AA**. (2026-09-05)
- **R12** — Tile placement (and any other interaction) must not be drag-only — must support single click/tap as an alternative to dragging (WCAG 2.2 SC 2.5.7 Dragging Movements). (2026-09-05)
- **R13** — Interactive targets (board cells, buttons, etc.) must meet the WCAG 2.2 SC 2.5.8 Target Size (Minimum) of at least 24x24 CSS pixels, with allowed exceptions. (2026-09-05)
- **R14** — The game must be fully operable by keyboard alone. (2026-09-05, implied by R10/R11)

## Platform / responsiveness

- **R15** — The game must be playable on desktop, tablet, and mobile phone, with responsive layout and first-class support for mouse, touch, and keyboard input. (2026-09-05)

## Process / documentation

- **R16** — Maintain a `README.md` with a general overview of the project. (2026-09-05)
- **R17** — Maintain this `requirements.md` detailing requirements as they are established. (2026-09-05)
- **R18** — Use git for version control of this project. (2026-09-05)
- **R19** — The project is open source under the **MIT License** (copyright Tim Harshbarger). (2026-09-05)

## Communication style (working agreement, not a game requirement)

- Explain reasoning and actions as work happens, not just a summary at the end.
- Comment code thoroughly to explain what it does and why, even where it might otherwise be considered self-evident.

## Game information model (from base-game research)

These aren't new requirements so much as constraints on the UI/data design, captured here so they aren't lost before we get to design:

- **Private to each player** (must never be shown to other players/opponents' views): tile hand contents, own stock holdings totals, own cash total.
- **Public to all players** (always visible): the full board state, each chain's size/tier/safety status, the price chart, shares remaining in the bank per chain, turn order, count of tiles left in the draw pile.
- **Public but transactional**: buying stock is an open action — *what* a player buys on their turn (chain + quantity) is visible to everyone as it happens (e.g. an event-log entry), even though their *cumulative* holdings/cash total afterward stays on their own private panel only.
- **Design implication:** the UI needs a clear separation between "your private panel" (hand, your stock, your cash) and "the public table state" (board, market, event log) — this matters especially for screen reader users, who need this distinction made explicit via structure/labeling rather than spatial layout. AI opponents' hidden information (hand contents, exact holdings) must not be readable by the human player's UI, and the AI's own decision logic should only use information it would legitimately know (this also matters for the "imperfect information" MCTS-style AI approach discussed earlier).

## Space theme glossary (confirmed 2026-09-05)

The mechanics are unchanged from base Acquire (same price brackets, 60/30 bonus split, 25-share cap per corporation, 41-tile/all-secure endgame triggers) — only terminology changes. Kept intentionally from the original design: **all 7 corporation names start with a different letter**, so players (and screen reader users navigating by first letter) can distinguish them instantly.

| Acquire term | Space term |
|---|---|
| Board | Star Map |
| Tile / board square | Sector (e.g. "Sector 6-B" — same letter+number coordinates as the original grid) |
| Hotel chain | Corporation |
| Founding a chain | Founding a corporation |
| Merger | Merger (unchanged) |
| Safe chain (11+ tiles) | Secure |
| Stock / shares | Shares (unchanged) |
| Cash | Credits |
| Tile bag / draw pool | Sector pool |

The 7 corporations (2 economy / 3 standard / 2 luxury, matching the original's tier split):

| Tier | Corporation |
|---|---|
| Economy | Nova Traders |
| Economy | Kestrel Mining |
| Standard | Orion Freight |
| Standard | Helios Energy |
| Standard | Vanguard Dynamics |
| Luxury | Titan Industries |
| Luxury | Zenith Consortium |

## AI opponents (confirmed 2026-09-05)

Configurable player count (2–6 total, one human + the rest AI), each AI opponent independently set to one of three difficulty tiers (easy = random legal moves, medium = one-ply heuristic scoring, hard = determinized Monte Carlo Tree Search), built entirely in vanilla JS with no AI/game libraries (consistent with R3). See `docs/ai-design.md` for the full design.

## Help feature (confirmed 2026-09-05)

Both a full "How to Play" reference (a scrollable `<dialog>`, always reachable from the header) and phase-specific contextual hints (a collapsible `<details>` near the turn status, updating with `turnPhase`). See `docs/help-design.md`.

## Open / not yet decided

- Save/resume support.
- Visual style/art direction.
