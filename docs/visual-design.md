# Visual design

Direction: **neon cyberpunk** — dark background, high-energy neon accents, angular sans-serif type. This is a starting direction with concrete roles assigned to each color, not a fully locked palette; exact hex values still need verification against a real WCAG contrast checker before implementation treats them as final (see "Open questions" below).

## Palette roles

Colors are assigned by **role**, not just picked for looks — this keeps the palette usable rather than just decorative:

- **Background**: near-black (`#0d0d14`, direction only).
- **Primary text**: near-white (`#eef0f5`, direction only) — not a neon color. Neons are reserved for accents; body copy, the event log, and help dialog content all need reliably high contrast against the dark background, which pure saturated neons don't consistently guarantee.
- **Corporation tier accent colors**: tied to the **3 price tiers** (see `requirements.md`'s space theme glossary) rather than 7 separate per-corporation hues — cyan for economy, magenta for standard, yellow for luxury (directional values only). This reinforces, but never replaces, the letter-based corporation identity already established in `docs/ui-design.md` (WCAG requires information not be conveyed by color alone). It's also thematically useful: color becomes a quick "how valuable is this tier" signal.
- **Interactive elements** (buttons, focus rings): neon-outlined against the dark background, with near-white text — keeps text contrast reliable while still reading as part of the neon aesthetic.

## Typography

Angular sans-serif, matching the cyberpunk direction. Exact typeface TBD during implementation (a suitable system font or a single self-hosted web font — no external CDN font loading, to keep the app fully self-contained per R3's "runs by loading static files directly" requirement).

## Motion and flashing — accessibility constraints specific to this aesthetic

Cyberpunk UIs commonly lean on glitch effects, scanlines, and pulsing/flickering glows. Two hard constraints apply here, on top of the general WCAG 2.2 AA requirement (R11):

- **No flashing content exceeding 3 times per second**, ever — this is a seizure-risk rule with no exceptions, not a "nice to have."
- **All animation (glow pulses, glitch transitions, scanline effects) must respect `prefers-reduced-motion`** — reduced or disabled entirely when a user has that OS/browser preference set.

## Open questions for the next design step

- Verify exact hex values for background/text/tier-accent colors against a real WCAG 2.2 AA contrast checker (4.5:1 for normal text, 3:1 for large text and UI components) — the values in this doc are directional, not final.
- Specific typeface choice.
- Exact glow/glitch/scanline effect treatments, scoped by the motion constraints above.
