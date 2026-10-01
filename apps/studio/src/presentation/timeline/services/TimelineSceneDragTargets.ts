import type { WordTimeLimits, WordTimeRange } from '@core/captions/services/WordTimeBounds';
import type { TimelineSceneMoveSubject } from '@presentation/timeline/controllers/TimelineEditingController';
import type { TimelineSceneExtent } from '@presentation/timeline/services/TimelineSceneExtentResolver';

const UNBOUNDED: WordTimeLimits = {
  earliestStartSec: Number.NEGATIVE_INFINITY,
  latestEndSec: Number.POSITIVE_INFINITY,
};

/** What dragging a scene, or one of its ends, needs to know about that scene. */
export interface TimelineSceneDragTarget extends TimelineSceneMoveSubject {
  /**
   * How far the window may be taken — clear of the hard time of the
   * scenes on its own sheet, and inside the video.
   */
  readonly limits: WordTimeLimits;
}

/**
 * Every scene the panel is drawing, looked up by segment id rather than
 * carried on each drawn scene run, because a scene is drawn once per row
 * it crosses and every piece would otherwise hold its own copy — and
 * because carrying a group needs scenes no row on screen may hold.
 */
export class TimelineSceneDragTargets {

  private readonly bySegmentId = new Map<string, TimelineSceneDragTarget>();
  /** Ascending start order, which is the order "after" is read in. */
  private readonly ordered: ReadonlyArray<TimelineSceneDragTarget>;

  constructor(
    scenes: ReadonlyArray<TimelineSceneExtent>,
    limitsBySegmentId: ReadonlyMap<string, WordTimeLimits> = new Map(),
    toneOf: (segmentId: string) => number = () => 0,
  ) {
    for (const scene of scenes) {
      const time = scene.segment.time;
      this.bySegmentId.set(scene.segment.id, {
        segmentId: scene.segment.id,
        text: scene.segment.getText(),
        toneIndex: toneOf(scene.segment.id),
        window: { startSec: time.start, endSec: time.end },
        extent: { startSec: scene.startSec, endSec: scene.endSec },
        words: this.wordSpanOf(scene),
        limits: limitsBySegmentId.get(scene.segment.id) ?? UNBOUNDED,
      });
    }
    this.ordered = [...this.bySegmentId.values()]
      .sort((a, b) => a.extent.startSec - b.extent.startSec || a.extent.endSec - b.extent.endSec);
  }

  get(segmentId: string): TimelineSceneDragTarget | null {
    return this.bySegmentId.get(segmentId) ?? null;
  }

  /** The scenes named, in start order, skipping any the panel is not drawing. */
  subjectsFor(segmentIds: ReadonlySet<string>): TimelineSceneMoveSubject[] {
    return this.ordered.filter((target) => segmentIds.has(target.segmentId));
  }

  /**
   * The scene and every drawn scene starting at the same instant or
   * later. Empty for a scene the panel is not drawing.
   */
  fromOnward(segmentId: string): ReadonlySet<string> {
    const from = this.bySegmentId.get(segmentId);
    if (!from) return new Set();
    return new Set(this.ordered
      .filter((target) => target.segmentId === segmentId || target.extent.startSec >= from.extent.startSec)
      .map((target) => target.segmentId));
  }

  /**
   * The scene and every drawn scene starting at the same instant or
   * earlier. Empty for a scene the panel is not drawing.
   */
  upTo(segmentId: string): ReadonlySet<string> {
    const to = this.bySegmentId.get(segmentId);
    if (!to) return new Set();
    return new Set(this.ordered
      .filter((target) => target.segmentId === segmentId || target.extent.startSec <= to.extent.startSec)
      .map((target) => target.segmentId));
  }

  private wordSpanOf(scene: TimelineSceneExtent): WordTimeRange | null {
    const words = scene.segment.getWords();
    const first = words[0];
    const last = words[words.length - 1];
    if (!first || !last) return null;
    return { startSec: first.time.start, endSec: last.time.end };
  }
}
