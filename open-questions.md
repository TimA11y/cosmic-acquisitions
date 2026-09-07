# Open questions and known issues

A consolidated view across all of `docs/*.md`'s individual "Open questions for the next design step" sections, cross-checked against what's actually implemented as of 2026-09-07 (commit `4b2e5a7`). The game is feature-complete for its core scope — everything below is either a deliberate, documented limitation, polish, or process work, not a missing core feature.

## Deliberate, known limitations

- **Hard AI's MCTS budget is an untuned first pass.** `js/ai/hard.js` uses `TOTAL_TIME_BUDGET_MS = 400`, `DETERMINIZATION_COUNT = 5`, `MAX_ROLLOUT_PLIES = 6` — reasonable starting values, not validated against real play. Worth revisiting if the tier feels too weak or turns feel slow. (`docs/ai-design.md`)

## Known bugs

None currently tracked. The previous entry — the Event Log's `aria-live` region over-announcing on every update (`js/ui/render.js`'s `renderEventLog()` clearing and rebuilding the whole `<ul>` on every `render()` call, causing screen readers to re-read the entire log instead of just the newest message) — was fixed in `db57aaf`: `renderEventLog()` now appends only entries beyond `listEl.children.length`, verified live with a `MutationObserver` showing pure-addition mutations across a real placement + AI turn.

## Visual / UX polish

- **No self-hosted display typeface.** Headings and body text both currently use a system-font stack; `docs/visual-design.md` envisioned a more distinctive self-hosted face for headings specifically (body text staying on system fonts either way, for readability).
- ~~No glow/glitch/scanline motion effects.~~ **Fixed.** Added: a slow (4s, low-amplitude) neon glow pulse on the `<h1>` title; a static glow on button hover/`:focus-visible` (including Star Map cell buttons); a static tier-colored glow on the Star Map's corporation star glyphs (`text-shadow: 0 0 3px currentColor`, so it automatically follows each tier's accent color); and a subtle (~3% opacity) animated CRT-style scanline overlay via `body::before` (a pseudo-element, so it never enters the accessibility tree, plus `pointer-events: none` so it can't intercept clicks). All animation cycles run on multi-second timescales, nowhere near the 3-flashes/second seizure-risk threshold. Every animated effect (title pulse, scanline drift) has a `prefers-reduced-motion` fallback that removes the animation entirely rather than just slowing it — verified directly via Playwright's `emulateMedia({ reducedMotion: "reduce" })`, confirming `animation-name: none` on both, with the title falling back to a static (non-pulsing) glow rather than losing the effect entirely.
- ~~No dedicated narrow-viewport (phone) breakpoints.~~ **Fixed.** The Star Map and Market tables can't shrink below their per-cell 24px touch-target minimum (R13), so both now sit inside their own `.star-map-scroll`/`.market-scroll` wrapper (`overflow-x: auto`) instead of forcing the whole page to scroll sideways — WCAG 1.4.10 Reflow explicitly exempts data tables from the no-2D-scrolling rule, but scopes the exemption to the table itself, not the page. Verified at a 320px viewport (the Reflow reference width): a real wheel gesture can scroll the table wrapper but cannot move the page itself. Along the way, also fixed a pre-existing, unrelated bug this surfaced: the skip-links used the classic `left: -9999px` off-screen-hiding technique, which creates negative scrollable overflow that was *already* inflating the page's horizontal scroll region at narrow widths, independent of the table issue — replaced with the same `clip-path` technique `.visually-hidden` already used elsewhere in this codebase.
- ~~Mandatory dialog copy wasn't audited against the original design doc's list.~~ **Fixed.** Audited 2026-09-07: every dialog's actual message-generating code (`js/ui/main.js`'s `describePlacementOutcome()` and `makeMandatory()` calls, `js/ui/render.js`'s founding/merger-survivor/share-disposition/buy-share copy, and the static Resume/New Game markup in `index.html`) matches — or in one case (the "grow" placement message specifying "sectors after" instead of the doc's ambiguous "sectors") slightly improves on — `docs/ui-design.md`'s illustrative examples. No actual copy defects; this was a documentation-currency gap, not a UI gap.

## Process

- **No CI workflow.** `npm test`/`npm run lint` only run locally today; there's no GitHub Actions (or equivalent) config running them automatically.

## Documentation hygiene (cosmetic, not functional)

None remaining. Every `docs/*.md`'s "Open questions" section was cleaned up as of 2026-09-07 — each now correctly states what's resolved and how, instead of listing stale questions that were actually answered during implementation.
