import type { CutRange } from '@core/cuts/domain/CutRegistry';

/**
 * Shrinks a raw silence span by a per-side breathing-room amount so a
 * cut leaves natural-sounding air next to the adjacent words instead
 * of clipping straight into speech. The same padder is shared by every
 * surface that turns a silence into a committable cut, so chips on the
 * timeline and auto-cut presets always agree on the resulting range.
 *
 * The per-side amount is capped at a fraction of the gap's own
 * duration so very short silences keep some content even after
 * padding. A gap that touches a video edge (the lead-in before the
 * first word, the tail-out after the last word) does not get padded on
 * the edge side — there is no neighbouring word to protect there.
 */
export class SilencePadder {

  constructor(
    private readonly perSidePaddingSec: number = 0.15,
    private readonly maxPaddingFractionPerSide: number = 0.2,
  ) {}

  /**
   * Returns the padded range, or `null` when padding consumes the
   * whole gap. Callers pass the raw gap bounds plus flags for each
   * end that mark whether the gap touches the video's lead-in or
   * tail-out edge.
   */
  pad(
    rawStartSec: number,
    rawEndSec: number,
    atVideoLeadingEdge: boolean,
    atVideoTrailingEdge: boolean,
  ): CutRange | null {
    const duration = rawEndSec - rawStartSec;
    const perSideCap = Math.min(this.perSidePaddingSec, duration * this.maxPaddingFractionPerSide);
    const padStart = atVideoLeadingEdge ? 0 : perSideCap;
    const padEnd = atVideoTrailingEdge ? 0 : perSideCap;
    const startSec = rawStartSec + padStart;
    const endSec = rawEndSec - padEnd;
    if (endSec <= startSec) return null;
    return { startSec, endSec };
  }
}
