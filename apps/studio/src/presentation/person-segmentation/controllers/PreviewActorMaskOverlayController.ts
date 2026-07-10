import { CssVariable, Segment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PersonSegmentationMask } from '@core/person-segmentation/domain/PersonSegmentationMask';
import { ActorMaskCanvasBuilder } from '@core/person-segmentation/infrastructure/ActorMaskCanvasBuilder';
import type { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';

const NEAREST_MASK_TOLERANCE_SEC = 0.15;

/**
 * Drives the actor-cutout overlay in the editor preview. On every
 * animation frame it checks whether any caption segment currently in
 * the DOM publishes an active text-behind-actor state, looks up the
 * nearest cached mask for the playback time read from the editor
 * store, samples the preview canvas the surface owns, and paints the
 * actor cutout onto its own overlay canvas so the caption text
 * underneath is occluded wherever the actor sits.
 *
 * The activation gate is the computed `--behind-actor-active` value
 * on the `.segment` elements under `segmentDomRoot` — the same CSS
 * resolution the template composes, so forced overrides and
 * template-specific activation rules apply without the controller
 * re-deriving them.
 *
 * Sample and overlay canvases stay sized to the preview canvas'
 * intrinsic pixels; on each tick the controller re-syncs the overlay
 * size before painting. The controller runs a single rAF loop while
 * started; stopping cancels the frame request and clears the overlay.
 */
export class PreviewActorMaskOverlayController {
  private readonly maskCanvasBuilder = new ActorMaskCanvasBuilder();
  private readonly overlayContext: CanvasRenderingContext2D;
  private rafHandle: number | null = null;
  private lastPaintedMask: PersonSegmentationMask | null = null;

  constructor(
    private readonly previewCanvas: HTMLCanvasElement,
    private readonly overlayCanvas: HTMLCanvasElement,
    private readonly segmentDomRoot: ParentNode,
    private readonly editorStore: EditorStore,
    private readonly loadedCacheStore: LoadedPersonSegmentationCacheStore,
  ) {
    const context = this.overlayCanvas.getContext('2d');
    if (context === null) throw new Error('Overlay canvas 2D context is unavailable');
    this.overlayContext = context;
  }

  start(): void {
    if (this.rafHandle !== null) return;
    this.scheduleNextFrame();
  }

  stop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.clearOverlay();
  }

  private scheduleNextFrame(): void {
    this.rafHandle = requestAnimationFrame(() => this.onFrame());
  }

  private onFrame(): void {
    this.rafHandle = null;
    this.paintCurrentFrame();
    this.scheduleNextFrame();
  }

  private paintCurrentFrame(): void {
    this.syncOverlaySize();
    const entry = this.loadedCacheStore.current;
    if (entry === null) {
      this.clearOverlay();
      return;
    }
    const state = this.editorStore.snapshot();
    if (state.projectId !== entry.projectId) {
      this.clearOverlay();
      return;
    }
    if (!this.hasActiveSegmentInDom()) {
      this.clearOverlay();
      return;
    }
    const mask = entry.result.maskCache.nearest(state.video.currentTime, NEAREST_MASK_TOLERANCE_SEC);
    if (mask === null) {
      this.clearOverlay();
      return;
    }
    this.paintCutout(mask);
    this.lastPaintedMask = mask;
  }

  private syncOverlaySize(): void {
    const targetWidth = this.previewCanvas.width;
    const targetHeight = this.previewCanvas.height;
    if (this.overlayCanvas.width !== targetWidth) this.overlayCanvas.width = targetWidth;
    if (this.overlayCanvas.height !== targetHeight) this.overlayCanvas.height = targetHeight;
  }

  private hasActiveSegmentInDom(): boolean {
    for (const segmentElement of this.segmentDomRoot.querySelectorAll(`.${Segment.CSS_CLASS}`)) {
      const active = getComputedStyle(segmentElement).getPropertyValue(CssVariable.BEHIND_ACTOR_ACTIVE);
      if (active.trim() === '1') return true;
    }
    return false;
  }

  private paintCutout(mask: PersonSegmentationMask): void {
    const width = this.overlayCanvas.width;
    const height = this.overlayCanvas.height;
    if (width === 0 || height === 0) return;
    const maskCanvas = this.maskCanvasBuilder.ensure(mask);
    this.overlayContext.globalCompositeOperation = 'source-over';
    this.overlayContext.clearRect(0, 0, width, height);
    this.overlayContext.drawImage(this.previewCanvas, 0, 0, width, height);
    this.overlayContext.globalCompositeOperation = 'destination-in';
    this.overlayContext.drawImage(maskCanvas, 0, 0, width, height);
    this.overlayContext.globalCompositeOperation = 'source-over';
  }

  private clearOverlay(): void {
    if (this.lastPaintedMask === null && this.overlayCanvas.width === 0) return;
    this.overlayContext.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    this.lastPaintedMask = null;
  }
}
