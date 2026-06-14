/**
 * CSS custom properties whose names are part of the contract between the
 * web app and template `style.css` files. Every property here is read by
 * at least one template via `var(<name>, <fallback>)` and emitted by a
 * known service in `core/`.
 *
 * Two groups are mixed by design:
 *  - Typography universals (font, spacing, alignment, decoration) that
 *    every template is expected to consume so the global typography
 *    controls take effect.
 *  - Well-known template-control names that the system also writes to —
 *    today `--tscaps-primary-color` (main text color, written on segment
 *    color overrides) and `--tscaps-highlight-color` (written by the
 *    per-segment color rotation). Both also exist as per-template style
 *    controls of the same id; the system override layers on top.
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
}
