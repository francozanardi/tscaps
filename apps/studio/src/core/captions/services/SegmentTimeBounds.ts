import type { Document, Section, Segment } from '@tscaps/engine';
import type { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import type { WordTimeLimits } from '@core/captions/services/WordTimeBounds';

/** How far a group of segments may be moved as one, in seconds either way. */
export interface SegmentShiftRange {
  /** Zero or negative: the furthest the group may go back. */
  readonly minDeltaSec: number;
  /** Zero or positive: the furthest the group may go forward. */
  readonly maxDeltaSec: number;
}

/**
 * The widest window each segment may occupy: clear of the hard time of
 * every segment sharing its sheet, and inside the video.
 *
 * **Only same-sheet segments are walls.** Two segments on different
 * sheets are meant to be able to claim the same instant — that is how a
 * caption and its translation, or a caption and a standing line, are
 * said at once — and each of those sheets is read in a channel of its
 * own. Inside one sheet there is no such thing: a sheet is one channel
 * and a channel is one sequence, so two of its segments sharing an
 * instant would be two texts with nowhere to draw the second.
 *
 * A sheet's segments are gathered from every section carrying it, not
 * only the one holding a given segment: routing a segment in the middle
 * of a document to another sheet splits its section in three, so one
 * sheet routinely spans several.
 *
 * The video's own ends are the outer wall — time outside them is never
 * rendered, so anything pushed past either end is content the export can
 * only drop. A duration of zero means the length is not known yet and
 * leaves the far end open.
 */
export class SegmentTimeBounds {

  constructor(private readonly hardTime: SegmentHardTime) {}

  /** Every segment's limits, by id, in one pass over the document. */
  allLimits(document: Document, videoDurationSec: number): ReadonlyMap<string, WordTimeLimits> {
    const videoEndSec = videoDurationSec > 0 ? videoDurationSec : Number.POSITIVE_INFINITY;
    const limits = new Map<string, WordTimeLimits>();
    for (const segments of this.sheets(document).values()) {
      segments.forEach((segment, index) => {
        limits.set(segment.id, {
          earliestStartSec: this.hardEndOf(segments[index - 1]),
          latestEndSec: Math.min(videoEndSec, this.hardStartOf(segments[index + 1])),
        });
      });
    }
    return limits;
  }

  /**
   * One segment's limits. Wide open for a segment the document does not
   * hold, which is the safe answer: the caller's own clamping still
   * applies and nothing is silently narrowed.
   */
  limitsFor(document: Document, segmentId: string, videoDurationSec: number): WordTimeLimits {
    const videoEndSec = videoDurationSec > 0 ? videoDurationSec : Number.POSITIVE_INFINITY;
    return this.allLimits(document, videoDurationSec).get(segmentId)
      ?? { earliestStartSec: 0, latestEndSec: videoEndSec };
  }

  /**
   * How far `segmentIds` may be moved together without any of them
   * reaching a same-sheet segment that stays behind, or leaving the
   * video.
   *
   * A neighbour that is moving too is not a wall: the two travel the
   * same distance, so the room between them never changes. Ids the
   * document does not hold, and segments with no hard time, constrain
   * nothing.
   */
  shiftRange(
    document: Document,
    segmentIds: ReadonlySet<string>,
    videoDurationSec: number,
  ): SegmentShiftRange {
    const videoEndSec = videoDurationSec > 0 ? videoDurationSec : Number.POSITIVE_INFINITY;
    let minDeltaSec = Number.NEGATIVE_INFINITY;
    let maxDeltaSec = Number.POSITIVE_INFINITY;
    let constrained = false;
    for (const segments of this.sheets(document).values()) {
      segments.forEach((segment, index) => {
        if (!segmentIds.has(segment.id)) return;
        const hard = this.hardTime.of(segment);
        if (!hard) return;
        constrained = true;
        const previous = segments[index - 1];
        const next = segments[index + 1];
        const earliestStartSec = previous && !segmentIds.has(previous.id) ? this.hardEndOf(previous) : 0;
        const latestEndSec = next && !segmentIds.has(next.id)
          ? Math.min(videoEndSec, this.hardStartOf(next))
          : videoEndSec;
        minDeltaSec = Math.max(minDeltaSec, earliestStartSec - hard.start);
        maxDeltaSec = Math.min(maxDeltaSec, latestEndSec - hard.end);
      });
    }
    if (!constrained) return { minDeltaSec: 0, maxDeltaSec: 0 };
    // A group already past a wall — an old project, say — is not pushed
    // anywhere by being picked up: it simply may not go further that way.
    return { minDeltaSec: Math.min(0, minDeltaSec), maxDeltaSec: Math.max(0, maxDeltaSec) };
  }

  private sheets(document: Document): ReadonlyMap<string, Segment[]> {
    const bySheetId = new Map<string, Segment[]>();
    for (const section of document.sections) this.collect(section, bySheetId);
    return bySheetId;
  }

  private collect(section: Section, bySheetId: Map<string, Segment[]>): void {
    const existing = bySheetId.get(section.kind);
    if (existing) existing.push(...section.segments);
    else bySheetId.set(section.kind, [...section.segments]);
  }

  private hardEndOf(previous: Segment | undefined): number {
    if (!previous) return 0;
    return this.hardTime.of(previous)?.end ?? 0;
  }

  private hardStartOf(next: Segment | undefined): number {
    if (!next) return Number.POSITIVE_INFINITY;
    return this.hardTime.of(next)?.start ?? Number.POSITIVE_INFINITY;
  }
}
