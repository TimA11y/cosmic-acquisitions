# Open questions and known issues

A consolidated view across all of `docs/*.md`'s individual "Open questions for the next design step" sections, cross-checked against what's actually implemented as of 2026-09-06 (commit `f8069c1`). The game is feature-complete for its core scope — everything below is either a deliberate, documented limitation, polish, or process work, not a missing core feature.

## Deliberate, known limitations

- **AI difficulty is fixed per game.** `js/ui/main.js`'s `aiDifficulties` map is only populated at setup time; there's no way to change an opponent's tier mid-session. This matches `docs/ai-design.md`'s default assumption, not an oversight.
- **Hard AI's MCTS budget is an untuned first pass.** `js/ai/hard.js` uses `TOTAL_TIME_BUDGET_MS = 400`, `DETERMINIZATION_COUNT = 5`, `MAX_ROLLOUT_PLIES = 6` — reasonable starting values, not validated against real play. Worth revisiting if the tier feels too weak or turns feel slow. (`docs/ai-design.md`)

## Known bugs

- **Event Log's `aria-live` region over-announces on every update.** Reported behavior: a screen reader re-reads the entire log from the start on each new entry, instead of announcing just the newest message. Root cause: `js/ui/render.js`'s `renderEventLog()` does `listEl.innerHTML = ""` and then re-appends *every* entry in `view.eventLog` on every call — since `render()` runs after every single action, this destroys and rebuilds the whole `<ul id="event-log-list" aria-live="polite">` subtree each time. From the browser/AT's perspective, the entire region's content was just replaced, not incrementally added to, so it announces everything rather than the diff — a well-known ARIA live-region anti-pattern. Fix direction: only append new entries since the last render (e.g. track how many entries have already been rendered, or diff against the previous `eventLog` length) instead of clearing and rebuilding the list every time. This is a real accessibility defect against R10/R11 (screen reader support, WCAG 2.2 AA), not just polish.

## Visual / UX polish

- **No self-hosted display typeface.** Headings and body text both currently use a system-font stack; `docs/visual-design.md` envisioned a more distinctive self-hosted face for headings specifically (body text staying on system fonts either way, for readability).
- **No glow/glitch/scanline motion effects.** Only basic `prefers-reduced-motion`-respecting hover/focus transitions exist so far — the fuller neon-cyberpunk motion treatment described in `docs/visual-design.md` was never built.
- **No dedicated narrow-viewport (phone) breakpoints.** `css/main.css` has a single 900px layout breakpoint; the Star Map table's behavior on genuinely narrow/mobile screens (horizontal scroll container, etc.) per `docs/ui-design.md` was never specifically addressed or tested.
- **Mandatory dialog copy wasn't audited against the original design doc's list.** Real wording exists for every dialog now, filled in during implementation, but nobody went back to check it against `docs/ui-design.md`'s original "exact wording" open item.

## Process

- **No CI workflow.** `npm test`/`npm run lint` only run locally today; there's no GitHub Actions (or equivalent) config running them automatically.

## Documentation hygiene (cosmetic, not functional)

These docs still list "Open questions" that were actually resolved during implementation but never marked as answered — worth a cleanup pass so they don't mislead a future reader:

- **`docs/file-layout.md`** — asks whether `js/ui/`/`js/ai/` need their own file-layout pass (they were built without one, making the question moot) and what the test-harness page should look like (`test/model-harness.html` answers this).
- **`docs/game-engine-api.md`** — asks about `js/model/` file layout (resolved, matches `js/model/`'s actual files exactly) and exact `eventLog` event types/messages (resolved — see `game.js`'s `appendEvent()` call sites).
- **`docs/persistence-design.md`** — asks about Resume/New Game dialog copy (resolved — see `#resume-dialog`/`#confirm-new-game-dialog` in `index.html`) and whether saves should carry a `schemaVersion` (resolved — `js/model/persistence.js` has one).
- **`docs/ui-design.md`** — three of its four open items are resolved (palette, mandatory dialog wording, how AI "thinking" is represented); only the narrow-viewport breakpoint question (listed above) is still genuinely open.
