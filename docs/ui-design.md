# UI design

This describes the screen structure and interaction patterns for Cosmic Acquisitions, built to satisfy the accessibility and responsiveness requirements in `requirements.md` (R10–R15) using plain HTML/CSS/JS (no framework — R3).

## Landmark structure

```html
<header>   <!-- Game title + persistent turn/phase status, e.g.
                "Your turn — place a Sector" or "Kestrel Mining AI is thinking…"
                This status text lives in an aria-live="polite" region so
                screen reader users hear turn changes without needing to poll. -->

<main>
  <section aria-labelledby="star-map-heading">   <!-- The 12x9 board -->
  <section aria-labelledby="your-ship-heading">  <!-- PRIVATE: hand, shares, credits -->
  <section aria-labelledby="market-heading">     <!-- PUBLIC: all 7 corporations' tier,
                                                       sector count, secure status, price,
                                                       shares remaining in the bank -->
  <section aria-labelledby="event-log-heading">  <!-- PUBLIC: running history,
                                                       also an aria-live region -->
</main>
```

Each section has a real visible `<h2>` heading, referenced via `aria-labelledby`, so screen reader users get an accurate landmark/heading list to jump between (e.g. via a screen reader's "jump to heading" navigation) instead of reading the whole page linearly. This structure also directly encodes the public/private split from `docs/data-model.md`: "Your Ship" is the only section holding this player's private data; everything else is public.

## Responsive strategy (decided 2026-09-05)

**One DOM order for every screen size** — the four sections above, stacked vertically, always in the same document order. A "skip to" link list at the very top of `<body>` (visually hidden until focused, standard skip-link pattern) lets keyboard/screen-reader users jump straight to any section:

```html
<nav aria-label="Skip to section">
  <a href="#star-map">Star Map</a>
  <a href="#your-ship">Your Ship</a>
  <a href="#market">Market</a>
  <a href="#event-log">Event Log</a>
</nav>
```

On wider viewports, CSS (media queries / CSS Grid) may reposition sections visually (e.g. board on the left, panels stacked on the right) but **must not reorder the underlying DOM** — visual repositioning without DOM reordering keeps keyboard tab order and screen reader reading order consistent across all screen sizes, so what a screen reader announces doesn't depend on viewport width.

This was chosen over a tabbed mobile layout specifically because it avoids having to hand-build a fully correct custom ARIA tabs widget (arrow-key switching, `aria-selected`, tab/panel association) with no framework to lean on — the tradeoff accepted is more scrolling for sighted mobile users.

## The Star Map (board)

Implemented as a **standard HTML `<table>`** — not an ARIA grid — since native table semantics already give screen readers row/column header association for free, and this game's coordinates (column 1–12, row A–I) map directly onto table headers:

```html
<table>
  <caption>Star Map</caption>
  <thead>
    <tr><th scope="col">&nbsp;</th><th scope="col">1</th><th scope="col">2</th> ... <th scope="col">12</th></tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">A</th>
      <td><!-- non-interactive: empty, or occupied sector --></td>
      ...
    </tr>
    ...
  </tbody>
</table>
```

Screen readers announce a cell's row/column headers automatically as the user navigates the table (e.g. NVDA/JAWS table navigation commands), so a cell is understood as "row A, column 6" without any custom ARIA needed.

**At most 6 cells are ever interactive at once, and only at the start of a player's turn.** Only the sectors that correspond to a tile currently in the player's hand — and only before that player has placed anything this turn — are rendered as `<button>` elements inside their `<td>`; every other cell is plain content. This directly reflects the rule that each tile has exactly one legal destination (see the correction earlier in this doc's history): there are at most 6 places on the whole board a player could ever legally act on, so there's no need to make all 108 cells interactive, and once the turn's one placement is used, there's nothing left to act on there at all.

Every occupied sector (placed, whether or not it's part of a corporation yet) shows a small **star glyph** — a decorative, thematic nod to "Star Map" — that is purely visual: it's `aria-hidden="true"` (or applied via CSS background/pseudo-element rather than real text content), so it's never read aloud on its own, and never the only signal of a cell's state.

The star glyph doesn't just pop into existence — the first time a sector actually goes from empty to occupied, it plays a one-shot "transporter beam-in" CSS animation (a cyan sweep clipped to the cell, plus the star itself fading/scaling in and settling into its normal static glow), evoking the neon-cyberpunk theme. This is purely decorative (same `aria-hidden` glyph, same accessible text) and, like every other animation in this app, has a `prefers-reduced-motion` fallback that removes it entirely. It plays exactly once per sector, the moment it's first occupied — not on every render, and not again if that sector later gets swept into a corporation or absorbed by a merger (those recolor instantly, same as before). `js/ui/render.js` tracks this via a "settled vs. current generation" occupancy diff, specifically because `render()` can (and does) fire more than once in a row for the exact same game state (e.g. `continueMergerResolution`'s own bookkeeping render, immediately followed by its caller's render) — a naive diff would treat the second, redundant render as "already seen" and erase the animation before it's visible.

Cell states:

- **Occupied, unincorporated** (placed, not yet part of any corporation — the `analyzePlacement()` `"none"` outcome becomes permanent here): the star glyph rendered white/near-white (the primary text color from `docs/visual-design.md`, not a tier accent — it hasn't been claimed by anything yet), no letter. Accessible text: `"Sector 6-B, unincorporated"` (reusing the term already established in the placement-confirmation dialog copy).
- **Occupied, part of a corporation**: the same star glyph, now recolored to that corporation's **tier accent color** (cyan/magenta/yellow per `docs/visual-design.md`), shown together with the corporation's **initial letter as visible text**, also in that tier color (not color alone — the letter reuses the "all 7 corporations start with a different letter" property from the theme glossary, satisfying the WCAG rule against color-only information). A visually-hidden span gives the full name for screen readers, e.g. visible `"N"` on a cyan star, accessible text `"part of Nova Traders"`.
- **Empty, non-interactive, not in hand**: visually blank (no star — nothing has been placed here), accessible text `"empty"`.
- **Empty, in hand, this turn's placement not yet made**: a `<button>`, accessible name e.g. `"Place Sector 6-B"`, with a "?" glyph shown inside it (pure CSS `::before` generated content — not exposed to the accessibility tree, so it can't create a duplicate/conflicting announcement alongside the explicit `aria-label`). Activating it opens the placement-confirmation dialog (see "Interaction model" below) rather than placing immediately.
- **Empty, in hand, but this turn's placement already made elsewhere**: non-interactive (the button is removed, not disabled), with accessible text noting the player still holds it, e.g. `"Sector 9-F, empty. You have this sector in your hand."`

Touch/click targets for these buttons meet the WCAG 2.2 SC 2.5.8 minimum of 24x24 CSS px (R13) at every supported viewport width, including phone.

## Interaction model

### Placing a tile

At the **start of a player's turn**, before they've placed anything, two equivalent entry points exist: "Your Ship" lists the player's hand as `<button>` elements (e.g. `"Sector 6-B"`), and the Star Map's matching table cells are also buttons (see above). Both call up the same **placement-confirmation dialog** for that sector id — clicking either one is interchangeable, whichever list is more convenient for the player.

The confirmation dialog is a cancelable native `<dialog>` (see "Dialogs" below) that states the outcome using `analyzePlacement()` (or `isDeadTile()` for a dead tile), before anything is committed:

| Case | Example dialog message | Confirm action |
|---|---|---|
| `analyzePlacement().effect === "none"` (isolated placement) | "Placing Sector 6-B will establish it as an unincorporated sector — no adjacent corporations." | `placeTile()` |
| `effect === "grow"` | "Placing Sector 6-B will add it to Nova Traders (12 sectors)." | `placeTile()` |
| `effect === "found"` | "Placing Sector 6-B will let you found a new corporation." | `placeTile()` (may open the mandatory "choose corporation" dialog next) |
| `effect === "merger"` | "Placing Sector 6-B will merge Nova Traders and Orion Freight." | `placeTile()` (may open "choose survivor" and/or share-disposition dialogs next) |
| `isDeadTile()` is true | "Sector 9-F is dead — it will be discarded and replaced with a new sector." | `exchangeDeadTile()` instead of `placeTile()` |

This dialog is cancelable — `Escape` or a "Cancel" button close it with no effect, since nothing has been committed yet; the player returns to their hand to pick a different tile. This confirm-before-commit step is the deliberate alternative to a general "undo" feature: reversing a placement after it's cascaded into a merger (bonuses paid, shares converted, possibly an AI's subsequent move already made) would require a lot of state-reversal complexity, whereas catching a mistake *before* the one truly consequential action commits covers the same practical need much more simply.

No drag gestures involved anywhere (R12).

### After the turn's tile is placed

The instant a tile is placed (via either entry point, after confirmation):

- That sector's Star Map cell permanently becomes an occupied, non-interactive cell (see cell states above) — it can never be an empty target again.
- Every *other* remaining hand tile's Star Map button is **removed** (not disabled) and replaced with the "empty, in hand, already placed elsewhere" indicator described above.
- Every *other* remaining hand tile's button in "Your Ship" **changes behavior**: instead of opening the placement dialog, clicking it now just moves keyboard focus to that sector's cell in the Star Map table — a "locate it on the map" convenience, not an action. This holds for the rest of that player's turn and through every other player's turn, reverting to placement behavior only at the start of this player's next `placingTile` phase.

This same "locate, don't act" behavior is what a dead tile's hand button falls back to outside of its own live placing moment — its Star Map cell is *never* a button at any time (placement there is always illegal), only its hand button is ever actionable, and only when it's this player's turn to place.

### Dialogs

All modal interactions use the native HTML `<dialog>` element (`showModal()`) rather than a hand-rolled `role="dialog"` div — a built-in browser feature (fits the no-framework requirement, R3) that gives automatic focus management (focus moves in on open, returns to the triggering control on close) and automatically makes the rest of the page inert while open, with no manual `inert`-attribute bookkeeping needed.

Two categories, with different dismissal behavior:

- **Mandatory decision dialogs** — choosing which corporation to found, choosing a tied merger's survivor, each shareholder's sell/trade/hold decision during merger resolution. These intercept the dialog's `cancel` event (fired by `Escape`) and call `preventDefault()` on it, since there's no valid way to abandon a mandatory decision — paired with a message via the existing live region explaining why, e.g. *"You must choose a corporation to continue."*
- **The placement-confirmation dialog** (described above) is the one cancelable dialog — nothing has been committed yet when it's open, so `Escape`/"Cancel" are allowed to work normally.

### Buying shares

Buy buttons are appended to each **active** corporation's row in the **Market** section, visible/enabled only during the acting player's `buyingShares` phase — e.g. `"Buy 1 share of Orion Freight — 300 Credits"`, calling `buyShares(gameState, playerId, corporationId, 1)` immediately on click (no confirmation dialog; a bad share purchase is a small, non-cascading mistake, unlike tile placement). Buttons use `aria-disabled="true"` (not the native `disabled` attribute) plus `aria-describedby` pointing to a reason — same pattern as the Star Map's dead-tile handling — for three cases: the player has already bought 3 shares this turn, can't afford that share, or the bank has none left for that corporation. A single `aria-live="polite"` status line in the Market section (not repeated per button) reads e.g. *"Share purchases this turn: 2 of 3 used,"* updated after each purchase.

"Your Ship" keeps an explicit **"End Turn"** button, visible during `buyingShares`, that calls `drawTile()` — this both draws the player's hand back to 6 sectors and advances to the next player, since buying 0–3 shares is optional and this is the only way to leave the phase.

## Open questions for the next design step

None remaining. All three are resolved:

- **Narrow-viewport table layout**: `.star-map-scroll`/`.market-scroll` wrapper divs (`overflow-x: auto`) around both tables in `index.html`/`css/main.css` — the table itself never shrinks below its 24px-per-cell touch-target minimum, and only the wrapper scrolls horizontally, not the page (WCAG 1.4.10). Pinch-to-zoom was never restricted.
- **Visual style/color palette**: finalized in `docs/visual-design.md`'s "Palette roles" section, with real WCAG 2.2 contrast ratios computed for every color, and implemented as CSS custom properties in `css/main.css`.
- **Exact mandatory-dialog wording**: audited 2026-09-07 against every actual dialog message in `js/ui/main.js`/`js/ui/render.js`/`index.html` — placement-confirmation's four outcome cases, all five mandatory-dialog cancel explanations, the share-disposition validation messages, and the buy-share/purchase-count copy all match (or, in one case — the "grow" placement message specifying "sectors after" instead of the doc's ambiguous "sectors" — improve on) the illustrative examples above.
- How AI turns are visually/audibly represented while "thinking" (e.g. a brief delay + status text vs. instant resolution).
