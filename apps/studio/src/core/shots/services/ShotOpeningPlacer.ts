/** The silence between two words a shot is about to open in, and what the picture does there. */
export interface ShotOpeningSilence {
  /** Where the last word before it ends: the earliest the shot may open. */
  readonly gapStartSec: number;
  /** Where the first word of the shot starts: the latest it may open. */
  readonly timeSec: number;
  /**
   * Where the source's own picture changes inside that silence — an edit
   * the video already carries, or another camera — or a frame or two
   * either side of it; null where it does not, or nothing looked.
   */
  readonly pictureChangeSec: number | null;
}

/**
 * Decides where, inside the silence between two words, a new shot
 * opens: the instant between the last word of one shot and the first
 * of the next.
 *
 * A picture change the source already carries there wins outright: a
 * cut placed a few frames off an edit the video already has shows
 * those frames of the old picture, which reads as a flash.
 *
 * Elsewhere the silence is shared out as margin. Word times are aligned
 * to the audio within a few hundredths of a second, so a cut on a word's
 * aligned start can open a shot on a sound already under way; the new
 * shot is given a lead before its first word, and the old one a tail
 * after its last, both as much as the silence allows. The lead is the
 * larger of the two: a clipped onset is heard where a clipped tail is
 * not. A silence too short for both is split in the same proportion,
 * and one with none leaves the cut on the word's start.
 *
 * The result always lies between where the last word ends and where the
 * next starts — a picture change aside, which may lie a frame or two
 * outside them.
 */
export class ShotOpeningPlacer {
  private static readonly LEAD_SEC = 0.15;
  private static readonly TAIL_SEC = 0.1;

  place(silence: ShotOpeningSilence): number {
    if (silence.pictureChangeSec !== null) return silence.pictureChangeSec;
    const lead = ShotOpeningPlacer.LEAD_SEC;
    const tail = ShotOpeningPlacer.TAIL_SEC;
    const gapSec = Math.max(0, silence.timeSec - silence.gapStartSec);
    if (gapSec >= lead + tail) return silence.timeSec - lead;
    return silence.gapStartSec + gapSec * (tail / (lead + tail));
  }
}
