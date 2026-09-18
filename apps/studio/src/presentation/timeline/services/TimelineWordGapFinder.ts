import type { TimelineSceneExtent } from '@presentation/timeline/services/TimelineSceneExtentResolver';

/** A stretch of the timeline that no word occupies. */
export interface TimelineWordGap {
  readonly startSec: number;
  readonly endSec: number;
}

/**
 * Finds the stretches of a timeline where nothing is being said.
 *
 * Every scene counts, including one whose words the timeline is not
 * currently drawing. A gap here is an offer to delete that stretch of
 * video, and accepting it would take any word occupying that time with
 * it — whether or not that word was on screen to be seen.
 */
export class TimelineWordGapFinder {

  /**
   * The stretches of `[0, totalSec]` no word covers, in order and never
   * touching. If the timeline contains no spoken words, returns an empty
   * array: without speech, the video has no conversational pauses to cut.
   */
  find(extents: ReadonlyArray<TimelineSceneExtent>, totalSec: number): TimelineWordGap[] {
    const spoken = this.spokenSpans(extents);
    if (spoken.length === 0) return [];
    const gaps: TimelineWordGap[] = [];
    let uncoveredFromSec = 0;
    for (const span of spoken) {
      if (span.startSec > uncoveredFromSec) {
        gaps.push({ startSec: uncoveredFromSec, endSec: span.startSec });
      }
      uncoveredFromSec = Math.max(uncoveredFromSec, span.endSec);
    }
    if (uncoveredFromSec < totalSec) {
      gaps.push({ startSec: uncoveredFromSec, endSec: totalSec });
    }
    return gaps;
  }

  // Merged rather than merely sorted: words may share time both within
  // a scene and across scenes, and a raw sweep over overlapping spans
  // would report the covered part of an overlap as a gap.
  private spokenSpans(extents: ReadonlyArray<TimelineSceneExtent>): TimelineWordGap[] {
    const spans = extents
      .flatMap((extent) => extent.segment.getWords())
      .map((word) => ({ startSec: word.time.start, endSec: word.time.end }))
      .sort((a, b) => a.startSec - b.startSec);
    const merged: TimelineWordGap[] = [];
    for (const span of spans) {
      const last = merged[merged.length - 1];
      if (last === undefined || span.startSec > last.endSec) {
        merged.push(span);
        continue;
      }
      if (span.endSec > last.endSec) {
        merged[merged.length - 1] = { startSec: last.startSec, endSec: span.endSec };
      }
    }
    return merged;
  }
}
