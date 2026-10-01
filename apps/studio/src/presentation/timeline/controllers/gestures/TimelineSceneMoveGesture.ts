import type { SegmentShiftRange } from '@core/captions/services/SegmentTimeBounds';
import type {
  TimelineEditingController,
  TimelineSceneMoveSubject,
} from '@presentation/timeline/controllers/TimelineEditingController';
import type { TimelineSnapResolver } from '@presentation/timeline/services/TimelineSnapResolver';

const NO_ROOM: SegmentShiftRange = { minDeltaSec: 0, maxDeltaSec: 0 };

/**
 * Turns pointer movement into how far a block of scenes is carried
 * through time. The block keeps its shape: every scene and every word in
 * it travels the same distance.
 *
 * The distance only ever lands on the editing controller as a preview.
 * Writing it for real re-runs the whole effects pipeline over the
 * document, which is fine once on release and hopeless once a frame.
 *
 * Either end of the block sticks to the landmarks of the scenes staying
 * where they are, whichever is pulled harder — the reader is watching
 * the end about to touch something. The block stops flush against a
 * same-sheet scene it is not carrying, and at the video's ends.
 */
export class TimelineSceneMoveGesture {

  private subjects: ReadonlyArray<TimelineSceneMoveSubject> = [];
  private room: SegmentShiftRange = NO_ROOM;
  private landmarksSec: ReadonlyArray<number> = [];
  private grabSec = 0;
  private startSec = 0;
  private endSec = 0;
  private previewing = false;

  constructor(
    private readonly editing: TimelineEditingController,
    private readonly snapResolver: TimelineSnapResolver,
    /** How far the given scenes may travel together, read against the document as it is now. */
    private readonly roomFor: (segmentIds: ReadonlySet<string>) => SegmentShiftRange,
    private readonly commit: (segmentIds: ReadonlyArray<string>, deltaSec: number) => void,
  ) {}

  /**
   * Arms the gesture. `landmarksSec` must already leave out the scenes
   * being carried. Returns false when there is nothing to carry.
   */
  begin(
    subjects: ReadonlyArray<TimelineSceneMoveSubject>,
    pointerSec: number,
    landmarksSec: ReadonlyArray<number>,
  ): boolean {
    if (subjects.length === 0) return false;
    this.subjects = subjects;
    this.room = this.roomFor(new Set(subjects.map((subject) => subject.segmentId)));
    this.landmarksSec = landmarksSec;
    this.grabSec = pointerSec;
    this.startSec = Math.min(...subjects.map((subject) => subject.extent.startSec));
    this.endSec = Math.max(...subjects.map((subject) => subject.extent.endSec));
    this.previewing = false;
    return true;
  }

  // The preview opens on the first movement rather than on the press, so
  // a press that never travels leaves the scenes exactly as it found them.
  extend(pointerSec: number, secondsPerPixel: number): void {
    if (this.subjects.length === 0) return;
    if (!this.previewing) {
      this.editing.startSceneMove(this.subjects);
      this.previewing = true;
    }
    const snappedSec = this.snapped(pointerSec - this.grabSec, secondsPerPixel);
    this.editing.updateSceneMove(Math.min(Math.max(snappedSec, this.room.minDeltaSec), this.room.maxDeltaSec));
  }

  /** Applies the previewed distance. A press that never travelled has nothing to apply. */
  finish(): void {
    const result = this.previewing ? this.editing.endSceneMove() : null;
    this.forget();
    if (!result) return;
    this.commit(result.segmentIds, result.deltaSec);
  }

  /** Drops the preview without writing anything. */
  cancel(): void {
    if (this.previewing) this.editing.endSceneMove();
    this.forget();
  }

  private forget(): void {
    this.subjects = [];
    this.previewing = false;
  }

  private snapped(deltaSec: number, secondsPerPixel: number): number {
    const proposedStartSec = this.startSec + deltaSec;
    const proposedEndSec = this.endSec + deltaSec;
    const startPullSec = this.snapResolver.snap(proposedStartSec, this.landmarksSec, secondsPerPixel) - proposedStartSec;
    const endPullSec = this.snapResolver.snap(proposedEndSec, this.landmarksSec, secondsPerPixel) - proposedEndSec;
    if (endPullSec !== 0 && (startPullSec === 0 || Math.abs(endPullSec) < Math.abs(startPullSec))) {
      return deltaSec + endPullSec;
    }
    return deltaSec + startPullSec;
  }
}
