import type { Document } from '@modules/document/Document';
import type { OverlayFrame, OverlayFrameRenderer } from '@modules/rendering/OverlayFrameRenderer';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { FrameCompositor } from '@modules/video/mediabunny/frame/FrameCompositor';
import type { SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';
import type { TopLayerSource } from '@modules/video/mediabunny/painter/TopLayerSource';
import type { PaintFrame } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';
import type { FramePainter } from '@modules/video/mediabunny/painter/FramePainter';

/**
 * Caption ticks step at the source's frame rate up to this cap. Past
 * it, per-letter or per-word animations gain nothing from extra renders
 * (the eye doesn't resolve sub-30fps differences in caption motion) and
 * the per-batch subtitle decode dominates the render budget.
 */
const CAPTION_FPS_CAP = 30;

/**
 * Paints each output frame as the source frame composited with a
 * per-timestamp caption raster and a frame-invariant overlay. The
 * caption strategy (batched, video-frame-bound, mixed) lives entirely
 * behind the {@link SubtitleLayerSource} injected in the constructor.
 *
 * Single-use: one open/close cycle per instance. Build a fresh one for
 * each transcode run through the factory.
 */
export class CaptionsOverlayFramePainter implements FramePainter {

  private width = 0;
  private height = 0;
  private overlay: OverlayFrame | null = null;

  constructor(
    private readonly subtitleLayer: SubtitleLayerSource,
    private readonly overlayRenderer: OverlayFrameRenderer,
    private readonly frameCompositor: FrameCompositor,
    private readonly document: Document,
    private readonly styles: Readonly<Record<string, SubtitleStyle>>,
    private readonly overlayHtml: string | undefined,
    private readonly topLayer: TopLayerSource | null,
  ) {}

  async begin(width: number, height: number, fps: number): Promise<void> {
    this.width = width;
    this.height = height;
    const captionInterval = 1 / Math.min(fps, CAPTION_FPS_CAP);
    await this.subtitleLayer.open(this.document, this.styles, width, height, captionInterval);
    if (this.overlayHtml !== undefined) {
      this.overlay = await this.overlayRenderer.render(this.overlayHtml, width, height);
    }
    if (this.topLayer !== null) {
      await this.topLayer.open(this.document, this.styles, width, height, captionInterval);
    }
  }

  async paint(frame: DecodedVideoFrame, _outputTimestamp: number): Promise<PaintFrame> {
    const captions = await this.subtitleLayer.frameAt(frame.timestamp, frame);
    const topLayer = this.topLayer === null ? null : await this.topLayer.frameAt(frame.timestamp, frame);
    return (ctx) => {
      this.frameCompositor.compose(ctx, {
        frame,
        captions,
        overlay: this.overlay,
        topLayer,
        width: this.width,
        height: this.height,
      });
    };
  }

  end(): void {
    this.subtitleLayer.close();
    this.topLayer?.close();
    this.overlay = null;
  }
}
