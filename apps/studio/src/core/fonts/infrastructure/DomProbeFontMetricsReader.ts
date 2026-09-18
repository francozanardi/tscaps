import { FontMetrics } from '@core/fonts/domain/FontMetrics';
import type { FontMetricsReader } from '@core/fonts/domain/FontMetricsReader';

const PROBE_FONT_SIZE_PX = 100;

/**
 * Reads a face's metrics by laying out an empty line in it and measuring
 * the box the browser gives it.
 *
 * Measured rather than read out of the font file, because the number
 * that matters is the one *this* engine will use: a font carries several
 * metric sets and which of them decides a line box is the browser's
 * choice, not the file's. Reading the file would risk declaring a box a
 * hair away from the one the same face already draws in, which would
 * move every existing caption.
 *
 * The probed line holds no text on purpose. An empty line box takes its
 * height from the strut alone, so a character the face cannot draw
 * cannot pull another font's metrics into the answer.
 *
 * Metrics never change for a family, so a face is measured once and
 * remembered. A face that was not loaded yet is not remembered, so it is
 * measured again on the next attempt.
 */
export class DomProbeFontMetricsReader implements FontMetricsReader {

  private readonly measured = new Map<string, FontMetrics>();
  private readonly requested = new Set<string>();

  read(family: string): FontMetrics | null {
    const remembered = this.measured.get(family);
    if (remembered !== undefined) return remembered;
    if (!this.isLoaded(family)) {
      this.requestOnce(family);
      return null;
    }
    const metrics = this.measure(family);
    this.measured.set(family, metrics);
    return metrics;
  }

  /**
   * `fonts.check` asks after the faces covering a space, which is the
   * one the browser takes the strut from and so the one about to be
   * measured.
   */
  private isLoaded(family: string): boolean {
    try {
      return document.fonts.check(`${PROBE_FONT_SIZE_PX}px '${family}'`);
    } catch {
      return false;
    }
  }

  /**
   * A face is fetched when something on the page is painted with it, and
   * a face named only behind a compiled family never is — the compiled
   * one draws first. So the measurement asks for it itself, and answers
   * nothing until it arrives: the page settles on the face's own metrics
   * on the derivation that follows.
   *
   * **Asked once per face and never again**, whatever the answer.
   * Asking sets `fonts.status` to `loading`, and a document that has
   * fonts loading is re-derived when they settle — so an ask that
   * repeats is a request loop that cannot end, and it would be driven
   * by exactly the faces that never load. One ask per face bounds it to
   * the faces in play, and a face that never arrives simply keeps the
   * metrics it was born with.
   *
   * A face the page registers nothing for rejects, and that is not a
   * failure: the family may be a generic or a system stack, which has
   * no metrics to override and needs none.
   */
  private requestOnce(family: string): void {
    if (this.requested.has(family)) return;
    this.requested.add(family);
    try {
      void document.fonts.load(`${PROBE_FONT_SIZE_PX}px '${family}'`).catch(() => undefined);
    } catch {
      return;
    }
  }

  private measure(family: string): FontMetrics {
    const line = document.createElement('div');
    line.style.cssText = `position:absolute;visibility:hidden;top:0;left:0;`
      + `font-family:'${family}';font-size:${PROBE_FONT_SIZE_PX}px;line-height:normal;`;
    const baseline = document.createElement('span');
    baseline.style.cssText = 'display:inline-block;width:0;height:0;';
    line.appendChild(baseline);
    document.body.appendChild(line);
    const lineBox = line.getBoundingClientRect();
    // A zero-height inline-block sits its bottom edge on the baseline.
    const ascent = baseline.getBoundingClientRect().bottom - lineBox.top;
    line.remove();
    return new FontMetrics(ascent / PROBE_FONT_SIZE_PX, (lineBox.height - ascent) / PROBE_FONT_SIZE_PX);
  }
}
