import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import type { TimelineEditingController } from '@presentation/timeline/controllers/TimelineEditingController';

/**
 * Keeps at most one thing in hand for Delete to act on: what the
 * timeline holds (a stretch of video or a scene) or a shot layer picked
 * on the preview. Both answer to the same key, so with both in hand one
 * press would remove the layer and cut the video at once.
 *
 * Whichever was taken last wins: picking a layer lets go of what the
 * timeline holds, and taking hold of a stretch or a scene lets go of a
 * picked layer. A caption picked on the preview is left alone; Delete
 * means nothing to it. Lifecycle is `start()` / `stop()`.
 */
export class TimelineLayerPickExclusionController {
  private pickedLayerId: string | null = null;
  private timelineHolds = false;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly overlaySelection: OverlaySelectionController,
    private readonly timeline: TimelineEditingController,
  ) {}

  start(): void {
    if (this.unsubscribe) return;
    this.pickedLayerId = this.layerPicked();
    this.timelineHolds = this.timelineHoldsSomething();
    this.unsubscribe = this.overlaySelection.subscribe(this.onOverlaySelectionChange);
    this.timeline.addEventListener('change', this.onTimelineChange);
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.timeline.removeEventListener('change', this.onTimelineChange);
  }

  private readonly onOverlaySelectionChange = (): void => {
    const picked = this.layerPicked();
    const newlyPicked = picked !== null && picked !== this.pickedLayerId;
    this.pickedLayerId = picked;
    if (newlyPicked) this.timeline.clearSelection();
  };

  private readonly onTimelineChange = (): void => {
    const holds = this.timelineHoldsSomething();
    const newlyHolds = holds && !this.timelineHolds;
    this.timelineHolds = holds;
    if (newlyHolds && this.layerPicked() !== null) this.overlaySelection.clearSelection();
  };

  private layerPicked(): string | null {
    const selection = this.overlaySelection.selectionSnapshot();
    return selection?.kind === 'shot-layer' ? selection.layerId : null;
  }

  private timelineHoldsSomething(): boolean {
    return this.timeline.selection !== null || this.timeline.selectedSceneId !== null;
  }
}
