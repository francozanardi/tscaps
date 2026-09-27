/**
 * Keeps each line on one visual row: a line is what a line splitter
 * decided, and letting the browser wrap it would paint rows no splitter
 * chose.
 *
 * A default, not a contract. A stylesheet that wants a long line to
 * wrap sets `white-space` on `.line` itself, so this belongs in the
 * framework layer, where any later layer overrides it without
 * `!important`.
 *
 * The selector is unqualified; a consumer rendering into a shared
 * document runs it through `CssScoper` first.
 */
export const LINE_NO_WRAP_CSS = '.line { white-space: nowrap; }';
