# Help design

Two complementary pieces, both built with native HTML elements (no framework — R3), both fully accessible per R10–R14.

## "How to Play" reference

A single, scrollable reference document — not a paginated or tabbed widget, consistent with the earlier decision (see `docs/ui-design.md`'s responsive strategy) to avoid hand-rolling custom ARIA widgets when a simpler native structure works.

- **Entry point**: an always-available **"How to Play" button in the header**, reachable from any screen and any `turnPhase` — not tucked away inside one of the four main sections, since it's relevant regardless of what the player is currently doing.
- **Presentation**: the same native `<dialog>` (`showModal()`) pattern used everywhere else in the UI (see `docs/ui-design.md`'s "Dialogs" section), but the freely-dismissible kind — `Escape` and a close button work normally, since reading reference material isn't a decision that needs to be intercepted the way the three mandatory gameplay dialogs are.
- **Content structure**: organized under real `<h2>`/`<h3>` headings (so screen readers can jump between sections) in space-theme terminology, per the glossary in `requirements.md`. Sections: the goal of the game, turn structure (placing a Sector, founding a Corporation, mergers and bonuses, buying Shares, drawing back to 6), what makes a Corporation secure, and how the game ends. This is effectively our own base-game research (captured earlier in this project's history) restated in-theme.
- Opening this dialog doesn't pause AI "thinking" — if an AI's move computation is already in progress (see `docs/ai-design.md`'s note on not blocking the main thread), it continues in the background exactly as it would if the dialog were closed, since reading help isn't game state that needs to be frozen.

## Contextual, phase-specific hints

Rather than adding more text to the header's turn-status live region (see `docs/ui-design.md`'s landmark structure) — which already auto-announces on every phase change and would get noisy for an experienced player if it also explained *how* to do each step every single turn — phase-specific guidance lives in a native **`<details>`/`<summary>` disclosure**, placed near the turn status in the header.

- **Collapsed by default**, summary text like *"Need help with this step?"* — fully keyboard/screen-reader accessible with no custom ARIA needed, since `<details>`/`<summary>` has built-in expand/collapse semantics.
- **Content updates to match the current `turnPhase`** — e.g., during `buyingShares`: *"You may buy up to 3 shares this turn from the Market, or press End Turn to skip."* During `placingTile`: explains the hand/Star Map placement buttons and the confirmation dialog. During the three mandatory decision phases: explains what the open dialog is asking for.
- **State is not forced closed on phase change** — if a player has expanded it, it stays expanded (only its text content updates) rather than collapsing and re-nagging every turn. This respects a player's choice to keep hints visible without being naggy toward someone who's already dismissed it once.
- Each hint's text can end with a link into the relevant section of the "How to Play" dialog, for a player who wants more depth than the short contextual explanation gives.

## Implementation notes (resolved 2026-09-06)

Both pieces are built, in `index.html`/`js/ui/render.js`/`js/ui/main.js`:

- **Exact copy** for both the full "How to Play" dialog and every contextual hint is now written (see `index.html`'s `#help-dialog` and `js/ui/render.js`'s `CONTEXTUAL_HINTS` lookup table) — no longer an open question.
- **Deep-linking is real**, not a plain-text reference: every heading in `#help-dialog` carries a stable id (`#help-placing`, `#help-founding`, `#help-mergers`, `#help-buying-shares`, `#help-drawing`, `#help-secure`, `#help-ending`) plus `tabindex="-1"`. Each contextual hint ends with a `.link-button` (a real `<button>` styled as an inline text link — a plain `<a href="#...">` can't both open a *closed* `<dialog>` and scroll to a spot inside it) carrying a `data-help-section` attribute. `js/ui/main.js`'s `openHelpDialog(sectionId)` opens the dialog, then `scrollIntoView()`s and `.focus()`s the target heading — the focus move (not just the scroll) is what makes this actually usable for keyboard/screen-reader users, not just a visual jump.
- Contextual hints are only shown for phases where the **human** has something to decide (`placingTile`, `buyingShares`, `choosingCorporationToFound`, `choosingMergerSurvivor`, `resolvingMerger`) — hidden entirely during an AI's turn, before a game exists, or once `turnPhase` is `"gameOver"`, none of which this doc's original scope anticipated (written before AI turns or game-over existed as concrete states).
