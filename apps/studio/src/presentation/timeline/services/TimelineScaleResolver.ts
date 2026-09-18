import type { Document } from '@tscaps/engine';

/**
 * How much of the clock a timeline shows, expressed as pixels per
 * second.
 *
 * Scale is the primitive rather than the duration of a row: a fixed
 * number of seconds per row would squeeze the words on a narrow phone
 * and scatter them on a wide monitor, while a fixed scale keeps a word
 * the same size everywhere and lets the row cover whatever fits.
 *
 * The opening scale is read off the document, because how many seconds
 * a legible chip has to span depends entirely on how fast the speaker
 * talks. With no words to go by, the whole video fits one row.
 *
 * It is read from a short word rather than a typical one: sizing so the
 * *median* word is legible guarantees by definition that half of them
 * are not, and the short ones are exactly the unreadable ones. A low
 * percentile states the goal directly, and being an order statistic it
 * ignores the handful of very long words a hand-written overlay
 * contributes.
 */
export class TimelineScaleResolver {

  /**
   * @param legibleChipWidthPx width a word chip needs before its text is
   * worth showing. At the chip's text size an average glyph runs about
   * 6.5px and the chip spends 8px on horizontal padding, so this covers
   * roughly five characters and its padding. It also has to clear the
   * chip's own furniture: two 8px resize handles, below which a chip is
   * all handle and has no text area at all.
   * @param legibleWordFraction share of the document's words that must
   * reach that width. Raising it zooms in — more of the short words
   * become readable, at the cost of fewer seconds per row and so more
   * rows to scroll through.
   */
  constructor(
    private readonly legibleChipWidthPx: number = 44,
    private readonly legibleWordFraction: number = 0.85,
  ) {}

  defaultPxPerSecond(document: Document, panelWidthPx: number, videoDurationSec: number): number {
    const shortestLegibleSec = this.legibleWordDurationSec(document);
    if (shortestLegibleSec !== null) return this.legibleChipWidthPx / shortestLegibleSec;
    if (videoDurationSec > 0) return panelWidthPx / videoDurationSec;
    return 0;
  }

  /** Seconds one row covers at the given scale. Zero when unmeasurable. */
  rowDurationSec(panelWidthPx: number, pxPerSecond: number): number {
    if (panelWidthPx <= 0 || pxPerSecond <= 0) return 0;
    return panelWidthPx / pxPerSecond;
  }

  /**
   * The longest a row may be asked to cover: the whole video in one.
   * Past that a row would hold time the video does not have, and the
   * panel would be one row with empty space after it.
   */
  longestRowDurationSec(videoDurationSec: number): number {
    return videoDurationSec > 0 ? videoDurationSec : 0;
  }

  /**
   * The shortest a row may be asked to cover: a typical word's own
   * duration, so a row always holds at least one whole word.
   *
   * The bound is a *limit*, not a target — it sits far deeper than
   * anyone reads at, and exists because zooming past it stops buying
   * anything. Once a typical word spans more than a row it is drawn in
   * pieces wherever it lands, and the panel reads as a column of
   * fragments rather than as text.
   */
  shortestRowDurationSec(document: Document): number {
    return this.wordDurationPercentileSec(document, 0.5) ?? 1;
  }

  /**
   * The duration below which only `1 - legibleWordFraction` of the
   * words fall.
   */
  private legibleWordDurationSec(document: Document): number | null {
    return this.wordDurationPercentileSec(document, 1 - this.legibleWordFraction);
  }

  /**
   * The word duration at `fraction` of the way up the sorted durations.
   * Zero-length words are left out: they carry no scale of their own and
   * one of them would drag the answer to nothing.
   */
  private wordDurationPercentileSec(document: Document, fraction: number): number | null {
    const durationsSec = document.getWords()
      .map((word) => word.time.end - word.time.start)
      .filter((durationSec) => durationSec > 0)
      .sort((a, b) => a - b);
    if (durationsSec.length === 0) return null;
    const index = Math.floor(fraction * durationsSec.length);
    return durationsSec[Math.min(index, durationsSec.length - 1)] ?? null;
  }
}
