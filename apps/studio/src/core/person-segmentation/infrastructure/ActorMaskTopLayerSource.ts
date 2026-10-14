import type {
  DecodedVideoFrame,
  OverlayFrame,
  TimeFragment,
  TopLayerSource,
} from '@tscaps/engine';
import type { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import { ActorMaskCanvasBuilder } from '@core/person-segmentation/infrastructure/ActorMaskCanvasBuilder';

const NEAREST_MASK_TOLERANCE_SEC = 0.15;

/**
 * Emits a per-frame overlay that carries only the actor's pixels
 * (source frame ANDed with the mask). Painted above the caption
 * raster, it occludes the caption text everywhere the actor sits in
 * front of it.
 *
 * `activeRanges` are the time ranges — in the render document's
 * timebase — where the effect is active; the caller resolves them per
 * segment up front from the same decision that publishes the
 * activation class. Frames outside every range — or with no cached
 * mask within the tolerance — return `null`, so the compositor skips
 * the top layer entirely.
 *
 * The working canvas and mask canvas are allocated on `open` and
 * reused across every frame; `close` releases them.
 *
 * The cutout is painted when the frame is drawn, not when it is asked
 * for. A caller gathers a run of frames before it composites any of
 * them, and both canvases hold one picture at a time: painted up front,
 * every frame of the run would draw the cutout of the last one, and the
 * actor would hold still for a run and jump to the next. Frames are
 * composited one after another, and each is still alive while it is,
 * so painting at draw time needs nothing kept per frame.
 */
export class ActorMaskTopLayerSource implements TopLayerSource {
  private maskCanvasBuilder: ActorMaskCanvasBuilder | null = null;
  private compositeCanvas: OffscreenCanvas | null = null;
  private compositeContext: OffscreenCanvasRenderingContext2D | null = null;
  private compositeWidth = 0;
  private compositeHeight = 0;

  constructor(
    private readonly maskCache: MaskCache,
    private readonly activeRanges: ReadonlyArray<TimeFragment>,
  ) {}

  async open(width: number, height: number): Promise<void> {
    this.maskCanvasBuilder = new ActorMaskCanvasBuilder();
    this.compositeCanvas = new OffscreenCanvas(width, height);
    this.compositeContext = this.requireContext(this.compositeCanvas);
    this.compositeWidth = width;
    this.compositeHeight = height;
  }

  async frameAt(time: number, videoFrame: DecodedVideoFrame): Promise<OverlayFrame | null> {
    const builder = this.maskCanvasBuilder;
    const context = this.compositeContext;
    const canvas = this.compositeCanvas;
    if (builder === null || context === null || canvas === null) return null;
    if (!this.isWithinActiveRange(time)) return null;
    const mask = this.maskCache.nearest(time, NEAREST_MASK_TOLERANCE_SEC);
    if (mask === null) return null;
    return {
      draw: (ctx, dx, dy, dw, dh) => {
        this.paintCutout(context, videoFrame, builder.ensure(mask));
        ctx.drawImage(canvas, dx, dy, dw, dh);
      },
    };
  }

  close(): void {
    this.maskCanvasBuilder = null;
    this.compositeCanvas = null;
    this.compositeContext = null;
    this.compositeWidth = 0;
    this.compositeHeight = 0;
  }

  private isWithinActiveRange(time: number): boolean {
    return this.activeRanges.some((range) => range.contains(time));
  }

  private paintCutout(
    context: OffscreenCanvasRenderingContext2D,
    videoFrame: DecodedVideoFrame,
    maskCanvas: OffscreenCanvas,
  ): void {
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, this.compositeWidth, this.compositeHeight);
    videoFrame.draw(context, 0, 0, this.compositeWidth, this.compositeHeight);
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(maskCanvas, 0, 0, this.compositeWidth, this.compositeHeight);
    context.globalCompositeOperation = 'source-over';
  }

  private requireContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('OffscreenCanvas 2D context is unavailable');
    return context;
  }
}
