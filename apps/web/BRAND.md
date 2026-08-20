# Wrapper visual system

Wrapper should feel like quiet infrastructure: precise, calm, and ready when a
session becomes active. The interface stays neutral until something is live.

## Principles

1. **Local first.** Product copy begins with what stays on the user's machine.
2. **Blue means active.** Electric blue is reserved for live paths, focus,
   confirmation, and the primary action.
3. **Technical, not dense.** Use short claims with a concrete visual or fact.
4. **One system in both themes.** Structure comes from ink and surface tokens;
   illustrations do not need separate light and dark markup.

## Color roles

### Light

- Canvas: `#F6F6F2`
- Surface: `#FFFFFF`
- Muted surface: `#ECEDE8`
- Ink: `#121316`
- Muted ink: `#62666E`
- Border: `#DCDDDA`
- Action blue: `#356DE8`
- Soft blue: `#E8EFFF`

### Dark

- Canvas: `#0D0F12`
- Surface: `#15181D`
- Muted surface: `#1C2026`
- Ink: `#F6F7F9`
- Muted ink: `#A8ADB5`
- Border: `#2B3038`
- Live blue: `#7AA7FF`
- Filled actions continue to use the darker action blue with white text.

Do not use blue as decoration. Device traffic lights and platform chrome may use
their authentic colors, but those colors are not part of the Wrapper palette.

## Typography

- Sans: the native system stack (`SF Pro` on Apple platforms)
- Mono: Geist Mono
- Hero: `56–80px`, weight 590–700, tight leading
- Section heading: `40–64px`, weight 590
- Card heading: `20–24px`, weight 590
- Body: `16–18px`, weight 400
- Label: `12–14px`, weight 510–590
- Command: `13–14px`, Geist Mono

Use weights `400`, `510`, `590`, and `700` with the variable system font. Keep
body copy below 62 characters per line and use sentence case for controls.

## Layout

- Base spacing unit: `4px`
- Scale: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128`
- Content maximum: `1280px`
- Responsive gutter: `20–80px`
- Radius: `8, 14, 24, 32px`, plus full pills
- Interactive target: at least `44×44px`

Prefer a hairline border before adding a shadow. Reserve stronger elevation for
the hero devices and temporary overlays.

All page, card, control, and illustration fills are flat. Do not use CSS or SVG
gradients anywhere in the product.

## Controls

- Buttons use full pills, solid fills, and no decorative glow.
- Primary actions use the accessible Wrapper blue.
- Navigation actions use the dark/light ink color.
- Secondary actions use a quiet neutral fill.
- Hover moves at most `1px`; press scales to `0.985`.
- Provider and destructive actions keep their semantic black/white and danger
  treatments while sharing the same control height and focus ring.

## Motion

- Micro feedback: `160ms`
- State change: `320ms`
- Entrance: `640ms`
- Standard exit: `cubic-bezier(0.22, 1, 0.36, 1)`
- Spring feedback: `cubic-bezier(0.34, 1.56, 0.64, 1)`

Hover movement is at most `1px`; pressed controls scale to `0.985`. Off-screen
loops stay paused. Reduced-motion visitors receive a vertical, non-pinned story
with static diagrams.

## Voice

Use “Wrapper” for the product and `wrapper` for the CLI or commands. Prefer
short, literal sentences:

- “Your terminal, still running. Wherever you are.”
- “Nothing leaves until you say so.”
- “Local is free. Remote is Pro.”

Avoid generic claims such as “revolutionary,” “effortless,” or “military-grade.”
Explain the mechanism instead.
