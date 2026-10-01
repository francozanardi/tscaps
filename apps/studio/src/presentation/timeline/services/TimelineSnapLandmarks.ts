import type { TimelineView } from '@core/timeline/domain/TimelineView';
import type { TimelineSceneExtent } from '@presentation/timeline/services/TimelineSceneExtentResolver';

/**
 * Every time on the timeline a dragged edge may stick to, deduplicated —
 * which depends on the level the timeline is read at, because a landmark
 * the reader cannot see would pull an edge towards a place with nothing
 * at it.
 *
 * - **Words**: the bounds of each scene and the edges of every word
 *   inside it. Word edges are included whole rather than reduced to the
 *   gaps between them, because a cut is as often "from where this word
 *   starts" as it is "over this pause".
 * - **Scenes**: the bounds of each scene, the window it is shown for, and
 *   where its words begin and end. The words in between are not drawn at
 *   this level, so their edges are not offered.
 *
 * Built from the scenes the panel is **drawing**, not from the whole
 * document: the scenes of another channel are not on screen either.
 */
export class TimelineSnapLandmarks {

  private readonly timesSec: ReadonlyArray<number>;
  private readonly timesBySegmentId = new Map<string, ReadonlyArray<number>>();

  constructor(scenes: ReadonlyArray<TimelineSceneExtent>, private readonly view: TimelineView) {
    const times = new Set<number>();
    for (const scene of scenes) {
      const own = this.timesOf(scene);
      this.timesBySegmentId.set(scene.segment.id, own);
      for (const time of own) times.add(time);
    }
    this.timesSec = [...times];
  }

  get all(): ReadonlyArray<number> {
    return this.timesSec;
  }

  /**
   * The landmarks left once the given scenes are taken away. Scenes
   * being carried take their own bounds and words with them, so those
   * would only ever pull the block towards where it already was.
   */
  excluding(segmentIds: ReadonlySet<string>): ReadonlyArray<number> {
    const times = new Set<number>();
    for (const [segmentId, own] of this.timesBySegmentId) {
      if (segmentIds.has(segmentId)) continue;
      for (const time of own) times.add(time);
    }
    return [...times];
  }

  private timesOf(scene: TimelineSceneExtent): number[] {
    const times = [scene.startSec, scene.endSec];
    const words = scene.segment.getWords();
    if (this.view === 'scenes') {
      const window = scene.segment.time;
      times.push(window.start, window.end);
      const first = words[0];
      const last = words[words.length - 1];
      if (first && last) times.push(first.time.start, last.time.end);
      return times;
    }
    for (const word of words) times.push(word.time.start, word.time.end);
    return times;
  }
}
