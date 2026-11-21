/** A text a graphic shows, as its page laid it out: what it says (shortened) and its size in px of the box as drawn. */
export interface GraphicTextSize {
  readonly text: string;
  readonly px: number;
}

/**
 * How the text of a graphic's page sat in its box in one frame: the
 * smallest text it showed, and the texts it showed cut, by the box's
 * edge or by an element that clips them. Text that is hidden (no
 * opacity, hidden, not displayed) is not counted. A graphic drawn on a
 * canvas shows no text the page can measure.
 */
export interface GraphicTextLayout {
  /** Null when the frame showed no text. */
  readonly smallest: GraphicTextSize | null;
  /** At most a few, each shortened; empty when nothing was cut. */
  readonly cut: ReadonlyArray<string>;
}
