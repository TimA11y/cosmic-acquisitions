# Visual design

Direction: **neon cyberpunk** — dark background, high-energy neon accents, angular sans-serif type. The palette below was finalized during `js/ui/`'s first implementation pass (2026-09-06) and verified against real WCAG 2.2 contrast math (see each color's ratio below) — no longer directional-only. Implemented as CSS custom properties in `css/main.css`.

## Palette roles

Colors are assigned by **role**, not just picked for looks — this keeps the palette usable rather than just decorative. Contrast ratios below are each color against the `#0d0d14` background, computed via the standard WCAG relative-luminance formula (AA requires 4.5:1 for normal text, 3:1 for large text/UI components):

- **Background**: near-black `#0d0d14`.
- **Primary text**: near-white `#eef0f5` (~17:1) — not a neon color. Neons are reserved for accents; body copy, the event log, and help dialog content all need reliably high contrast against the dark background, which pure saturated neons don't consistently guarantee.
- **Corporation tier accent colors**: tied to the **3 price tiers** (see `requirements.md`'s space theme glossary) rather than 7 separate per-corporation hues — cyan `#4deeea` for economy (~13.6:1), magenta `#ff6ec7` for standard (~7.7:1), yellow `#f9f871` for luxury (~17.2:1). All three comfortably clear 4.5:1, so they're safe to use for normal-sized text as well as UI components (the Star Map's corporation-initial letters use these directly as text color). This reinforces, but never replaces, the letter-based corporation identity already established in `docs/ui-design.md` (WCAG requires information not be conveyed by color alone). It's also thematically useful: color becomes a quick "how valuable is this tier" signal.
- **Interactive elements** (buttons, focus rings): neon-outlined against the dark background, with near-white text — keeps text contrast reliable while still reading as part of the neon aesthetic. Focus rings use a dedicated `#ffffff` outline via `:focus-visible`, since the default browser focus ring is easy to lose against a dark theme.

## Typography

Angular sans-serif, matching the cyberpunk direction. For `js/ui/`'s first pass, this uses a **system-font stack** (`ui-sans-serif, "Segoe UI", Roboto, sans-serif`) rather than a self-hosted display font — simpler to ship correctly (no font-loading/FOUT concerns) and still keeps the app fully self-contained per R3. A more distinctive self-hosted angular display face (for headings only, keeping body text on the system stack for readability) remains an open polish item, not ruled out.

## Motion and flashing — accessibility constraints specific to this aesthetic

Cyberpunk UIs commonly lean on glitch effects, scanlines, and pulsing/flickering glows. Two hard constraints apply here, on top of the general WCAG 2.2 AA requirement (R11):

- **No flashing content exceeding 3 times per second**, ever — this is a seizure-risk rule with no exceptions, not a "nice to have."
- **All animation (glow pulses, glitch transitions, scanline effects) must respect `prefers-reduced-motion`** — reduced or disabled entirely when a user has that OS/browser preference set.

## Open questions for the next design step

- A distinctive self-hosted display typeface for headings (body text should stay on the system stack regardless, for readability).
- Exact glow/glitch/scanline effect treatments, scoped by the motion constraints above — `js/ui/`'s first pass has no motion effects yet beyond simple, `prefers-reduced-motion`-respecting hover/focus transitions.
