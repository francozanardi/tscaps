import type { EditorStore } from '@core/editor/store/EditorStore';

// Kept clear of a stretch's ends, where a transition or the frame of the next take can show.
const EDGE_SEC = 0.15;
// A stretch shorter than this is looked at once, in its middle.
const SHORT_SEC = 0.8;
const SHARES = [0.15, 0.5, 0.85];

/**
 * The moments a stretch of the video is looked at: its start, middle and
 * end, kept clear of its edges and moved out of anything cut away, in
 * seconds of the source video.
 */
export class PartMoments {
  constructor(private readonly store: EditorStore) {}

  /** Up to three moments inside `startSec`–`endSec`, ascending; one for a short stretch. */
  of(startSec: number, endSec: number): number[] {
    const from = startSec + EDGE_SEC;
    const to = endSec - EDGE_SEC;
    if (to - from < SHORT_SEC) return [this.rounded((startSec + endSec) / 2)];
    const cuts = this.store.snapshot().cuts;
    const moments = SHARES.map((share) => from + (to - from) * share).filter((sec) => !cuts.isCut(sec));
    return moments.length > 0 ? moments.map((sec) => this.rounded(sec)) : [this.rounded((startSec + endSec) / 2)];
  }

  private rounded(sec: number): number {
    return Math.round(sec * 100) / 100;
  }
}
