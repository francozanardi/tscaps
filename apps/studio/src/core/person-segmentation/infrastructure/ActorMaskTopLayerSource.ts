import type {
  DecodedVideoFrame,
  Document,
  OverlayFrame,
  SubtitleStyle,
  TopLayerSource,
} from '@tscaps/engine';
import type { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import { ActorMaskCanvasBuilder } from '@core/person-segmentation/infrastructure/ActorMaskCanvasBuilder';
import { BehindActorEffectQuery } from '@core/person-segmentation/infrastructure/BehindActorEffectQuery';

const NEAREST_MASK_TOLERANCE_SEC = 0.15;

/**
 * Emits a per-frame overlay that carries only the actor's pixels
 * (source frame ANDed with the mask). Painted above the caption
 * raster, it occludes the caption text everywhere the actor sits in
 * front of it. Frames whose timestamp lands outside any scene-valid
 * segment — or with no cached mask within the tolerance — return
 * `null`, so the compositor skips the top layer entirely.
 *
 * The working canvas and mask canvas are allocated on `open` and
 * reused across every `frameAt` call; `close` releases them.
 */
export class ActorMaskTopLayerSource implements TopLayerSource {
  private effectQuery: BehindActorEffectQuery | null = null;
  private maskCanvasBuilder: ActorMaskCanvasBuilder | null = null;
  private compositeCanvas: OffscreenCanvas | null = null;
  private compositeContext: OffscreenCanvasRenderingContext2D | null = null;
  private compositeWidth = 0;
  private compositeHeight = 0;

  constructor(private readonly maskCache: MaskCache) {}

  async open(
    doc: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    width: number,
    height: number,
  ): Promise<void> {
    this.effectQuery = new BehindActorEffectQuery(doc, styles);
    this.maskCanvasBuilder = new ActorMaskCanvasBuilder();
    this.compositeCanvas = new OffscreenCanvas(width, height);
    this.compositeContext = this.requireContext(this.compositeCanvas);
    this.compositeWidth = width;
    this.compositeHeight = height;
  }

  async frameAt(time: number, videoFrame: DecodedVideoFrame): Promise<OverlayFrame | null> {
    const query = this.effectQuery;
    const builder = this.maskCanvasBuilder;
    const context = this.compositeContext;
    const canvas = this.compositeCanvas;
    if (query === null || builder === null || context === null || canvas === null) return null;
    if (!query.hasActiveEffectAt(time)) return null;
    const mask = this.maskCache.nearest(time, NEAREST_MASK_TOLERANCE_SEC);
    if (mask === null) return null;
    this.paintCutout(context, videoFrame, builder.ensure(mask));
    return { draw: (ctx, dx, dy, dw, dh) => ctx.drawImage(canvas, dx, dy, dw, dh) };
  }

  close(): void {
    this.effectQuery = null;
    this.maskCanvasBuilder = null;
    this.compositeCanvas = null;
    this.compositeContext = null;
    this.compositeWidth = 0;
    this.compositeHeight = 0;
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
