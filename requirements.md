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

## Open / not yet decided

- Exact set of space-theme names/reskins for chains, tiles, board terminology.
- Number of AI opponents and difficulty levels.
- AI algorithm approach (Monte Carlo Tree Search is the leading candidate based on research into existing Acquire implementations).
- Save/resume support.
- Visual style/art direction.
