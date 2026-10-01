import type { WordTimeRange } from '@core/captions/services/WordTimeBounds';
import type { TimelineEditingController } from '@presentation/timeline/controllers/TimelineEditingController';
import type { TimelineSceneDragTarget } from '@presentation/timeline/services/TimelineSceneDragTargets';

/** Which end of a scene's window the pointer took hold of. */
export type TimelineSceneDragEdge = 'start' | 'end';

/**
 * Turns pointer movement into a scene's new window: one edge follows
 * the pointer, the other stays where it was.
 *
 * The window only ever lands on the editing controller as a preview.
 * Writing it for real re-runs the whole effects pipeline over the
 * document, which is fine once on release and hopeless once a frame.
 *
 * The window is held clear of the hard time of the scenes on its own
 * sheet, and inside the video. Shrinking it past its own words is not
 * clamped: a scene may be held on screen for less time than it narrates,
 * and the words stay drawn where they are so the consequence is visible.
 *
 * Snapping happens before the range reaches here, against the landmarks
 * every dragged edge on the timeline shares.
 */
export class TimelineSceneEditGesture {

  private target: TimelineSceneDragTarget | null = null;
  private edge: TimelineSceneDragEdge = 'end';
  private previewing = false;

  constructor(
    private readonly editing: TimelineEditingController,
    private readonly commit: (segmentId: string, startSec: number, endSec: number) => void,
  ) {}

  /** Arms the gesture. Returns false when the scene is not one the panel is drawing. */
  begin(target: TimelineSceneDragTarget | null, edge: TimelineSceneDragEdge): boolean {
    if (!target) return false;
    this.target = target;
    this.edge = edge;
    this.previewing = false;
    return true;
  }

  // The preview opens on the first movement rather than on the press, so
  // a press that never travels leaves the scene exactly as it found it.
  extend(pointerSec: number): void {
    const target = this.target;
    if (!target) return;
    if (!this.previewing) {
      this.editing.startSceneEdit(target, target.window);
      this.previewing = true;
    }
    this.editing.updateSceneEdit(this.windowFor(pointerSec, target));
  }

  /**
   * Applies the previewed window. A press that never travelled opened no
   * preview and so ends with nothing to apply.
   */
  finish(): void {
    const result = this.editing.endSceneEdit();
    this.forget();
    if (!result) return;
    this.commit(result.segmentId, result.range.startSec, result.range.endSec);
  }

  /** Drops the preview without writing anything. */
  cancel(): void {
    if (this.previewing) this.editing.endSceneEdit();
    this.forget();
  }

  private forget(): void {
    this.target = null;
    this.previewing = false;
  }

  private windowFor(pointerSec: number, target: TimelineSceneDragTarget): WordTimeRange {
    const { window, limits } = target;
    if (this.edge === 'start') {
      return { startSec: Math.max(pointerSec, limits.earliestStartSec), endSec: window.endSec };
    }
    return { startSec: window.startSec, endSec: Math.min(pointerSec, limits.latestEndSec) };
  }
}
