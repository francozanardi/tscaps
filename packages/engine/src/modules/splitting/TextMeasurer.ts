/**
 * Resolves the rendered pixel width of a span of text. Implementations
 * decide how (DOM probe, Canvas 2D, lookup table, WASM, etc.); pixel-width
 * line splitters consume only this contract and stay agnostic to the
 * measurement strategy. Consumers can plug in their own implementation
 * when they have richer typography information than the default probe
 * can recover from CSS alone.
 */
export interface TextMeasurer {
  /** Width of `text` rendered as a single inline run, in px. */
  measure(text: string): number;
  /** Width of an inter-word space, in px. */
  spaceWidth(): number;
}
