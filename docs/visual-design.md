# Visual design

Direction: **neon cyberpunk** — dark background, high-energy neon accents, angular sans-serif type. The palette below was finalized during `js/ui/`'s first implementation pass (2026-09-06) and verified against real WCAG 2.2 contrast math (see each color's ratio below) — no longer directional-only. Implemented as CSS custom properties in `css/main.css`.

## Palette roles

Colors are assigned by **role**, not just picked for looks — this keeps the palette usable rather than just decorative. Contrast ratios below are each color against the `#0d0d14` background, computed via the standard WCAG relative-luminance formula (AA requires 4.5:1 for normal text, 3:1 for large text/UI components):

- **Background**: near-black `#0d0d14`.
- **Primary text**: near-white `#eef0f5` (~17:1) — not a neon color. Neons are reserved for accents; body copy, the event log, and help dialog content all need reliably high contrast against the dark background, which pure saturated neons don't consistently guarantee.
- **Corporation tier accent colors**: tied to the **3 price tiers** (see `requirements.md`'s space theme glossary) rather than 7 separate per-corporation hues — cyan `#4deeea` for economy (~13.6:1), magenta `#ff6ec7` for standard (~7.7:1), yellow `#f9f871` for luxury (~17.2:1). All three comfortably clear 4.5:1, so they're safe to use for normal-sized text as well as UI components (the Star Map's corporation-initial letters use these directly as text color). This reinforces, but never replaces, the letter-based corporation identity already established in `docs/ui-design.md` (WCAG requires information not be conveyed by color alone). It's also thematically useful: color becomes a quick "how valuable is this tier" signal.
- **Interactive elements** (buttons, focus rings): neon-outlined against the dark background, with near-white text — keeps text contrast reliable while still reading as part of the neon aesthetic. Focus rings use a dedicated `#ffffff` outline via `:focus-visible`, since the default browser focus ring is easy to lose against a dark theme.

## Typography

Angular sans-serif, matching the cyberpunk direction. Body text (paragraphs, buttons, table cells, list items) stays on the **system-font stack** (`ui-sans-serif, "Segoe UI", Roboto, sans-serif`) for readability. Every heading (`h1`–`h4`, site-wide) uses a self-hosted display face, **Orbitron** (SIL Open Font License — see `fonts/OFL.txt`), a geometric/angular sci-fi face that reads clearly as a distinct "display" tier above body copy. Shipped as `fonts/orbitron-bold-subset.woff2` — a single bold-weight instance of the upstream variable font, subsetted to printable ASCII only, ~6KB. `font-display: optional` means the browser only swaps to it if it loads near-instantly (true for a small same-origin local file); otherwise the fallback stack is used for the whole page load with no later swap, avoiding the FOUT the original system-font-only choice was written to avoid. Confirmed working over a genuine `file://` open (not just through a dev server), since font resource loads — unlike ES module imports — aren't blocked by `file://`'s same-origin restriction.

## Motion and flashing — accessibility constraints specific to this aesthetic

Cyberpunk UIs commonly lean on glitch effects, scanlines, and pulsing/flickering glows. Two hard constraints apply here, on top of the general WCAG 2.2 AA requirement (R11):

- **No flashing content exceeding 3 times per second**, ever — this is a seizure-risk rule with no exceptions, not a "nice to have."
- **All animation (glow pulses, glitch transitions, scanline effects) must respect `prefers-reduced-motion`** — reduced or disabled entirely when a user has that OS/browser preference set.

## Open questions for the next design step

None remaining.

- **Self-hosted display typeface**: see "Typography" above — Orbitron, self-hosted, headings only.
- **Glow/glitch/scanline effect treatments**: `css/main.css` now has a slow neon glow pulse on the header title, a static glow on button hover/`:focus-visible`, a tier-colored static glow on Star Map star glyphs, and a `body::before` animated CRT scanline overlay. Glitch effects specifically were left out — harder to keep unambiguously compliant with the no-flashing-over-3x/second rule for no real payoff over glow+scanline. Every animated piece has a verified `prefers-reduced-motion` fallback that removes the animation entirely.
