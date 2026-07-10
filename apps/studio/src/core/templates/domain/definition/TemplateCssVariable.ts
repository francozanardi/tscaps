/**
 * CSS custom properties whose names are part of the contract between the
 * web app and template `style.css` files. Every property here is read by
 * at least one template via `var(<name>, <fallback>)` and emitted by a
 * known service in `core/`.
 *
 * Three groups are mixed by design:
 *  - Typography universals (font, spacing, alignment, decoration) that
 *    every template is expected to consume so the global typography
 *    controls take effect.
 *  - Well-known template-control names that the system also writes to —
 *    today `--tscaps-primary-color` (main text color, written on segment
 *    color overrides) and `--tscaps-highlight-color` (written by the
 *    per-segment color rotation). Both also exist as per-template style
 *    controls of the same id; the system override layers on top.
 *  - Template-declared values the system reads to keep its own inline
 *    styling in sync with the template's render rules.
 *    `--tscaps-font-size-scale`: templates that grow or shrink the
 *    segment font size (e.g. dynamic font size) expose this multiplier
 *    on `.segment` so per-word font-size overrides scale alongside the
 *    rest of the caption. Templates that don't declare it fall back to
 *    a neutral `1`. `--tscaps-behind-lift`: behind-actor templates
 *    declare a `behind-lift` style control and the system applies the
 *    lift itself — geometry must move the interaction boxes with the
 *    caption, which template CSS cannot do. Templates without the
 *    control fall back to `0px` (no lift).
 *
 * Other template-specific style controls (`--tscaps-bg-padding-x`,
 * `--tscaps-bubble-color`, etc.) are *not* enumerated here: their names
 * live in each template's JSON `styleControls` and are derived
 * dynamically.
 */
export enum TemplateCssVariable {
  FONT_FAMILY = '--tscaps-font-family',
  FONT_SIZE = '--tscaps-font-size',
  FONT_WEIGHT = '--tscaps-font-weight',
  FONT_STYLE = '--tscaps-font-style',
  LETTER_SPACING = '--tscaps-letter-spacing',
  WORD_SPACING = '--tscaps-word-spacing',
  LINE_SPACING = '--tscaps-line-spacing',
  TEXT_ALIGN = '--tscaps-text-align',
  TEXT_TRANSFORM = '--tscaps-text-transform',
  TEXT_DECORATION = '--tscaps-text-decoration',
  ROTATION = '--tscaps-rotation',

  PRIMARY_COLOR = '--tscaps-primary-color',
  HIGHLIGHT_COLOR = '--tscaps-highlight-color',

  FONT_SIZE_SCALE = '--tscaps-font-size-scale',
  BEHIND_ACTOR_LIFT = '--tscaps-behind-lift',
}
