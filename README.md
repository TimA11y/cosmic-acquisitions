# Cosmic Acquisitions

[![CI](https://github.com/TimA11y/cosmic-acquisitions/actions/workflows/ci.yml/badge.svg)](https://github.com/TimA11y/cosmic-acquisitions/actions/workflows/ci.yml)

A turn-based, space-themed variant of Sid Sackson's board game *Acquire*, playable in a browser against AI opponents.

## What this is

The player places sector tiles on a shared Star Map, founding, growing, and merging space corporations (a reskin of Acquire's hotel chains). Players buy shares in corporations, and when corporations merge, majority/minority shareholders cash out in Credits. The game is turn-based: one human player competes against one or more AI-controlled players.

This document is a living overview of the project. See [requirements.md](requirements.md) for the detailed, itemized requirements list, and [open-questions.md](open-questions.md) for what's still unresolved.

## Status

**Feature-complete against the core design docs.** The full rules engine, UI, save/resume, in-game help, and all three AI difficulty tiers (including hard-tier determinized MCTS) are implemented and covered by an automated test suite. See [open-questions.md](open-questions.md) for known gaps (mostly visual polish, a couple of empirically-untuned constants, and one known accessibility bug in the Event Log's live region) — nothing left is a missing core feature.

### Playing it

Open `index.html` directly in a browser (double-click it) — no build step, no server required.

If you'd rather serve it over `http://` (e.g. to test with browser devtools that behave differently on `file://` URLs), any static file server works from the project root:

```
npx serve .          # then open the URL it prints (defaults to http://localhost:3000)
```

```
python -m http.server 8000    # then open http://localhost:8000
```

### Running the dev tooling

```
npm install
npm run lint        # ESLint over js/**, steps/**
npm run lint:html    # html-validate over *.html
npm run lint:css     # Stylelint over css/**
npm test             # Cucumber/BDD scenarios via Playwright (bddgen && playwright test)
```

## License

MIT — see [LICENSE](LICENSE).

The self-hosted heading typeface, [Orbitron](https://github.com/google/fonts/tree/main/ofl/orbitron), is separately licensed under the SIL Open Font License — see [fonts/OFL.txt](fonts/OFL.txt). `fonts/orbitron-bold-subset.woff2` is a bold-weight, printable-ASCII-only subset of the original variable font, built to keep the shipped file small.

## Tech stack

- **Runtime (shipped app):** vanilla JavaScript, HTML, and CSS. No frameworks, no bundler, no build step — the game runs by opening `index.html` (or serving the static files) directly in a browser.
- **Dev tooling (not shipped):** Node.js/npm used only for linting, validation, and testing.
  - ESLint — JavaScript linting
  - html-validate — HTML validation
  - Stylelint — CSS linting/validation
  - Cucumber.js + playwright-bdd — BDD tests (Gherkin `.feature` files driving real Playwright browser sessions)
  - `@axe-core/playwright` — automated accessibility testing, run inside the same Playwright/BDD browser sessions

## Project layout

```
cosmic_acquisitions/
  index.html          # entry point — open this directly in a browser
  css/
    main.css
  fonts/
    orbitron-bold-subset.woff2  # self-hosted heading typeface (OFL-licensed)
    OFL.txt
  js/
    model/            # pure-function rules engine (js/model/index.js is the public surface)
    ui/               # DOM rendering + event wiring (main.js, render.js, storage.js)
    ai/               # easy/medium/hard AI tiers, dispatched via ai/index.js
  test/
    model-harness.html  # loads js/model/ as a real ES module, for BDD tests to drive
  features/           # Cucumber .feature files (Gherkin scenarios)
  steps/              # Cucumber step definitions (Playwright-driven)
  scripts/
    test-server.mjs   # dependency-free static server used only by the test suite
  docs/               # design reference docs (data model, UI, AI, persistence, help, visual)
  package.json        # dev dependencies only — not required to run the shipped game
  README.md
  requirements.md
  open-questions.md
```

## Design docs

- [requirements.md](requirements.md) — itemized requirements
- [docs/data-model.md](docs/data-model.md) — core game-state shape (board, corporations, players, bank, public/private info split)
- [docs/game-engine-api.md](docs/game-engine-api.md) — pure functions that read/transition game state, and the full turn state machine
- [docs/ui-design.md](docs/ui-design.md) — screen structure, accessible Star Map grid, responsive strategy, interaction model
- [docs/ai-design.md](docs/ai-design.md) — AI opponent difficulty tiers (random / heuristic / determinized MCTS) and how they use the game engine API
- [docs/help-design.md](docs/help-design.md) — "How to Play" reference dialog and phase-specific contextual hints
- [docs/file-layout.md](docs/file-layout.md) — `js/model/` file split, dependency direction, and BDD testing implications
- [docs/persistence-design.md](docs/persistence-design.md) — save/resume via `localStorage`, save points, and `Map`/`Set` serialization
- [docs/visual-design.md](docs/visual-design.md) — neon cyberpunk visual direction, palette roles, typography, motion/flashing constraints

## Key design constraints

- **Accessibility is a first-class requirement**, not a retrofit: the UI must conform to **WCAG 2.2 Level AA** and be fully usable with a screen reader.
- **Playable on desktop, tablet, and mobile phone** — responsive layout, touch/mouse/keyboard all supported as first-class input methods.
- **AI opponents** are core to the design (single human vs. AI players), not an add-on — the game state model needs to support clean AI move evaluation from the start.

See [requirements.md](requirements.md) for the full itemized list, and [open-questions.md](open-questions.md) for what's still unresolved.
