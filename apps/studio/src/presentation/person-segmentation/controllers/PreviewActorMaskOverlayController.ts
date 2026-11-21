import { CssClass, Segment } from '@tscaps/engine';
import { FootageFramedOverlayFrame, type FootageLayerFrameState } from '@tscaps/engine/advanced';
import type { PictureBackdropStates } from '@presentation/person-segmentation/PictureBackdropStates';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PersonSegmentationMask } from '@core/person-segmentation/domain/PersonSegmentationMask';
import { ActorCutoutPainter } from '@core/person-segmentation/infrastructure/ActorCutoutPainter';
import { ActorMaskCanvasBuilder } from '@core/person-segmentation/infrastructure/ActorMaskCanvasBuilder';
import type { PreviewShownPicture } from '@core/preview/domain/PreviewShownPicture';
import type { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';

const NEAREST_MASK_TOLERANCE_SEC = 0.15;

/**
 * Drives the actor-cutout overlay in the editor preview. On every
 * animation frame it checks whether any caption segment currently in
 * the DOM publishes an active text-behind-actor state, looks up the
 * nearest cached mask for the playback time read from the editor
 * store, samples the picture the preview has on screen — the composed
 * one, footage and grade included, while footage shows — and paints the
 * actor cutout onto its own overlay canvas, the mask placed where the
 * video's own picture landed on that picture, so the caption text
 * underneath is occluded wherever the actor sits, cropped, zoomed or
 * re-framed alike.
 *
 * The activation gate is the `behind-actor-active` class on the
 * `.segment` elements under `segmentDomRoot` — the same class the
 * template's stylesheet reacts to, so the cutout and the caption's
 * styling always flip together — or `behind-actor-partial`, on a
 * segment that keeps its place while a word inside it goes behind.
 *
 * The overlay stays sized to the sampled canvas' intrinsic pixels; on
 * each tick the controller re-syncs it before painting. A moment with
 * no picture to sample, or where a layer hides the video's own picture,
 * paints nothing. Where backdrop footage layers draw the picture again
 * (a transition between shots), the cutout is cut from the picture
 * beneath them and drawn in their states, so the actor dims, blurs and
 * moves with the picture, as the export draws it. The controller runs a
 * single rAF loop while started; stopping cancels the frame request and
 * clears the overlay.
 */
export class PreviewActorMaskOverlayController {
  private readonly maskCanvasBuilder = new ActorMaskCanvasBuilder();
  private readonly cutoutPainter = new ActorCutoutPainter();
  private readonly overlayContext: CanvasRenderingContext2D;
  private rafHandle: number | null = null;
  private lastPaintedMask: PersonSegmentationMask | null = null;
  private cutoutCanvas: OffscreenCanvas | null = null;

  constructor(
    private readonly shownPicture: () => PreviewShownPicture | null,
    private readonly overlayCanvas: HTMLCanvasElement,
    private readonly segmentDomRoot: ParentNode,
    private readonly editorStore: EditorStore,
    private readonly loadedCacheStore: LoadedPersonSegmentationCacheStore,
    private readonly backdrops: PictureBackdropStates,
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
    const shown = this.shownPicture();
    if (shown === null || shown.sourcePicture === null) {
      this.clearOverlay();
      return;
    }
    this.syncOverlaySize(shown.canvas);
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
    this.paintCutout(mask, shown, this.backdrops.statesAt(state.video.currentTime));
    this.lastPaintedMask = mask;
  }

  private syncOverlaySize(sampled: HTMLCanvasElement): void {
    const targetWidth = sampled.width;
    const targetHeight = sampled.height;
    if (this.overlayCanvas.width !== targetWidth) this.overlayCanvas.width = targetWidth;
    if (this.overlayCanvas.height !== targetHeight) this.overlayCanvas.height = targetHeight;
  }

  private hasActiveSegmentInDom(): boolean {
    for (const segmentElement of this.segmentDomRoot.querySelectorAll(`.${Segment.CSS_CLASS}`)) {
      const classes = segmentElement.classList;
      if (classes.contains(CssClass.BEHIND_ACTOR_ACTIVE) || classes.contains(CssClass.BEHIND_ACTOR_PARTIAL)) return true;
    }
    return false;
  }

  private paintCutout(
    mask: PersonSegmentationMask,
    shown: PreviewShownPicture,
    backdrops: ReadonlyArray<FootageLayerFrameState>,
  ): void {
    const width = this.overlayCanvas.width;
    const height = this.overlayCanvas.height;
    if (width === 0 || height === 0 || shown.sourcePicture === null) return;
    const maskCanvas = this.maskCanvasBuilder.ensure(mask);
    const drawShown = (target: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D) =>
      target.drawImage(shown.canvas, 0, 0, width, height);
    if (backdrops.length === 0) {
      this.cutoutPainter.paint(this.overlayContext, width, height, drawShown, maskCanvas, shown.sourcePicture);
      return;
    }
    const cutout = this.cutoutCanvasOf(width, height);
    this.cutoutPainter.paint(cutout.getContext('2d')!, width, height, drawShown, maskCanvas, shown.sourcePicture);
    const overlay = { draw: (target: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D) => target.drawImage(cutout, 0, 0, width, height) };
    this.overlayContext.globalCompositeOperation = 'source-over';
    this.overlayContext.clearRect(0, 0, width, height);
    new FootageFramedOverlayFrame(overlay, backdrops, width, height).draw(this.overlayContext);
  }

  private cutoutCanvasOf(width: number, height: number): OffscreenCanvas {
    if (this.cutoutCanvas === null || this.cutoutCanvas.width !== width || this.cutoutCanvas.height !== height) {
      this.cutoutCanvas = new OffscreenCanvas(width, height);
    }
    return this.cutoutCanvas;
  }

  private clearOverlay(): void {
    if (this.lastPaintedMask === null && this.overlayCanvas.width === 0) return;
    this.overlayContext.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    this.lastPaintedMask = null;
  }
}
