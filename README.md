# Project X — working title

A turn-based, space-themed variant of Sid Sackson's board game *Acquire*, playable in a browser against AI opponents.

## What this is

The player takes tiles representing sectors of space and places them on a shared map, founding, growing, and merging space-faring factions (a reskin of Acquire's hotel chains). Players buy stock in factions, and when factions merge, majority/minority shareholders cash out. The game is turn-based: one human player competes against one or more AI-controlled players.

This document is a living overview of the project. See [requirements.md](requirements.md) for the detailed, itemized requirements list.

## Status

Requirements gathering. No code yet.

## License

MIT — see [LICENSE](LICENSE).

## Tech stack

- **Runtime (shipped app):** vanilla JavaScript, HTML, and CSS. No frameworks, no bundler, no build step — the game runs by opening `index.html` (or serving the static files) directly in a browser.
- **Dev tooling (not shipped):** Node.js/npm used only for linting, validation, and testing.
  - ESLint — JavaScript linting
  - html-validate — HTML validation
  - Stylelint — CSS linting/validation
  - Cucumber.js + playwright-bdd — BDD tests (Gherkin `.feature` files driving real Playwright browser sessions)
  - `@axe-core/playwright` — automated accessibility testing, run inside the same Playwright/BDD browser sessions

## Project layout (planned)

```
projectx/
  index.html
  css/
  js/
  features/        # Cucumber .feature files (Gherkin scenarios)
  steps/            # Cucumber step definitions (Playwright-driven)
  docs/             # design reference docs (data model, etc.)
  package.json      # dev dependencies only
  README.md
  requirements.md
```

## Design docs

- [requirements.md](requirements.md) — itemized requirements
- [docs/data-model.md](docs/data-model.md) — core game-state shape (board, corporations, players, bank, public/private info split)
- [docs/game-engine-api.md](docs/game-engine-api.md) — pure functions that read/transition game state, and the full turn state machine
- [docs/ui-design.md](docs/ui-design.md) — screen structure, accessible Star Map grid, responsive strategy, interaction model

## Key design constraints

- **Accessibility is a first-class requirement**, not a retrofit: the UI must conform to **WCAG 2.2 Level AA** and be fully usable with a screen reader.
- **Playable on desktop, tablet, and mobile phone** — responsive layout, touch/mouse/keyboard all supported as first-class input methods.
- **AI opponents** are core to the design (single human vs. AI players), not an add-on — the game state model needs to support clean AI move evaluation from the start.

See [requirements.md](requirements.md) for the full itemized list, and the game design research summary earlier in this project's history for background on Acquire's mechanics and prior art (existing digital clones, AI approaches).
