# Open questions and known issues

A consolidated view across all of `docs/*.md`'s individual "Open questions for the next design step" sections, cross-checked against what's actually implemented as of 2026-09-07 (commit `db57aaf`). The game is feature-complete for its core scope — everything below is either a deliberate, documented limitation, polish, or process work, not a missing core feature.

## Deliberate, known limitations

- **Hard AI's MCTS budget is an untuned first pass.** `js/ai/hard.js` uses `TOTAL_TIME_BUDGET_MS = 400`, `DETERMINIZATION_COUNT = 5`, `MAX_ROLLOUT_PLIES = 6` — reasonable starting values, not validated against real play. Worth revisiting if the tier feels too weak or turns feel slow. (`docs/ai-design.md`)

## Known bugs

None currently tracked. The previous entry — the Event Log's `aria-live` region over-announcing on every update (`js/ui/render.js`'s `renderEventLog()` clearing and rebuilding the whole `<ul>` on every `render()` call, causing screen readers to re-read the entire log instead of just the newest message) — was fixed in `db57aaf`: `renderEventLog()` now appends only entries beyond `listEl.children.length`, verified live with a `MutationObserver` showing pure-addition mutations across a real placement + AI turn.

## Visual / UX polish

- **No self-hosted display typeface.** Headings and body text both currently use a system-font stack; `docs/visual-design.md` envisioned a more distinctive self-hosted face for headings specifically (body text staying on system fonts either way, for readability).
- **No glow/glitch/scanline motion effects.** Only basic `prefers-reduced-motion`-respecting hover/focus transitions exist so far — the fuller neon-cyberpunk motion treatment described in `docs/visual-design.md` was never built.
- ~~No dedicated narrow-viewport (phone) breakpoints.~~ **Fixed.** The Star Map and Market tables can't shrink below their per-cell 24px touch-target minimum (R13), so both now sit inside their own `.star-map-scroll`/`.market-scroll` wrapper (`overflow-x: auto`) instead of forcing the whole page to scroll sideways — WCAG 1.4.10 Reflow explicitly exempts data tables from the no-2D-scrolling rule, but scopes the exemption to the table itself, not the page. Verified at a 320px viewport (the Reflow reference width): a real wheel gesture can scroll the table wrapper but cannot move the page itself. Along the way, also fixed a pre-existing, unrelated bug this surfaced: the skip-links used the classic `left: -9999px` off-screen-hiding technique, which creates negative scrollable overflow that was *already* inflating the page's horizontal scroll region at narrow widths, independent of the table issue — replaced with the same `clip-path` technique `.visually-hidden` already used elsewhere in this codebase.
- **Mandatory dialog copy wasn't audited against the original design doc's list.** Real wording exists for every dialog now, filled in during implementation, but nobody went back to check it against `docs/ui-design.md`'s original "exact wording" open item.

## Process

- **No CI workflow.** `npm test`/`npm run lint` only run locally today; there's no GitHub Actions (or equivalent) config running them automatically.

## Documentation hygiene (cosmetic, not functional)

These docs still list "Open questions" that were actually resolved during implementation but never marked as answered — worth a cleanup pass so they don't mislead a future reader:

- **`docs/file-layout.md`** — asks whether `js/ui/`/`js/ai/` need their own file-layout pass (they were built without one, making the question moot) and what the test-harness page should look like (`test/model-harness.html` answers this).
- **`docs/game-engine-api.md`** — asks about `js/model/` file layout (resolved, matches `js/model/`'s actual files exactly) and exact `eventLog` event types/messages (resolved — see `game.js`'s `appendEvent()` call sites).
- **`docs/persistence-design.md`** — asks about Resume/New Game dialog copy (resolved — see `#resume-dialog`/`#confirm-new-game-dialog` in `index.html`) and whether saves should carry a `schemaVersion` (resolved — `js/model/persistence.js` has one).
- **`docs/ui-design.md`** — three of its four open items are resolved (palette, mandatory dialog wording, how AI "thinking" is represented); only the narrow-viewport breakpoint question (listed above) is still genuinely open.
