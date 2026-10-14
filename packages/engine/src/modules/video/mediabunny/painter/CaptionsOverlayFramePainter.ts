import type { Document } from '@modules/document/Document';
import type { OverlayFrame, OverlayFrameRenderer } from '@modules/rendering/OverlayFrameRenderer';
import type { SubtitleFrame, SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { FrameCompositor } from '@modules/video/mediabunny/frame/FrameCompositor';
import type { SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';
import type { SubtitleLayerSourceFactory } from '@modules/video/mediabunny/caption/SubtitleLayerSourceFactory';
import type { CaptionLayerFrame } from '@modules/video/mediabunny/frame/FrameCompositor';
import type { TopLayerSource } from '@modules/video/mediabunny/painter/TopLayerSource';
import type { FrameBackdrop } from '@modules/video/mediabunny/painter/FrameBackdrop';
import type { PaintFrame } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';
import type { FramePainter, FramePaintRequest } from '@modules/video/mediabunny/painter/FramePainter';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { OverlaidVideoFrame } from '@modules/video/mediabunny/frame/OverlaidVideoFrame';
import type { CaptionLayerDemand } from '@modules/rendering/CaptionLayerDemand';
import { CaptionLayer } from '@modules/rendering/types/CaptionLayer';

/**
 * Caption ticks step at the source's frame rate up to this cap. Past
 * it, per-letter or per-word animations gain nothing from extra renders
 * (the eye doesn't resolve sub-30fps differences in caption motion) and
 * the per-batch subtitle decode dominates the render budget.
 */
const CAPTION_FPS_CAP = 30;

/**
 * Paints each output frame as its backdrop — the source frame, or what
 * stands in for it — composited with the per-timestamp caption rasters
 * and a frame-invariant overlay. The caption strategy (batched,
 * video-frame-bound, mixed) lives entirely behind the
 * {@link SubtitleLayerSource}s the factory builds.
 *
 * One source per caption layer the document paints in, each opened
 * only with the styles that paint there — a run that blends nothing
 * and puts nothing over the top layer opens the base layer alone.
 *
 * Single-use: one open/close cycle per instance. Build a fresh one for
 * each transcode run through the factory.
 */
export class CaptionsOverlayFramePainter implements FramePainter {

  private width = 0;
  private height = 0;
  private overlay: OverlayFrame | null = null;
  /** The sources opened for this run, in paint order. */
  private opened: Array<{ readonly layer: CaptionLayer; readonly source: SubtitleLayerSource }> = [];

  constructor(
    private readonly layerSources: SubtitleLayerSourceFactory,
    private readonly layerDemand: CaptionLayerDemand,
    private readonly overlayRenderer: OverlayFrameRenderer,
    private readonly frameCompositor: FrameCompositor,
    private readonly document: Document,
    private readonly styles: Readonly<Record<string, SubtitleStyle>>,
    private readonly overlayHtml: string | undefined,
    private readonly topLayer: TopLayerSource | null,
    private readonly backdrop: FrameBackdrop,
  ) {}

  async begin(width: number, height: number, fps: number): Promise<void> {
    this.width = width;
    this.height = height;
    const captionInterval = 1 / Math.min(fps, CAPTION_FPS_CAP);
    const kindsByLayer = this.layerDemand.layersPaintedBy(this.document, this.styles);
    for (const layer of CaptionLayer.inPaintOrder(kindsByLayer.keys())) {
      const kinds = kindsByLayer.get(layer)!;
      const styles = Object.fromEntries(Object.entries(this.styles).filter(([kind]) => kinds.has(kind)));
      // Captions sampling nothing keep the transparency of what they sample.
      const source = this.layerSources.create(layer, !this.backdrop.showsFramePixels());
      await source.open(this.document, styles, width, height, captionInterval);
      this.opened.push({ layer, source });
    }
    if (this.overlayHtml !== undefined) {
      this.overlay = await this.overlayRenderer.render(this.overlayHtml, width, height);
    }
    if (this.topLayer !== null) {
      await this.topLayer.open(width, height);
    }
  }

  lookAhead(): number {
    return Math.max(1, ...this.opened.map(({ source }) => source.lookAhead()));
  }

  async paint(requests: ReadonlyArray<FramePaintRequest>): Promise<PaintFrame[]> {
    const bases = requests.map(({ frame }) => this.backdrop.beneath(frame));
    const layerRequests = requests.map(({ frame }) => ({
      time: frame.timestamp,
      videoFrame: this.beneathCaptions(this.backdrop.sampledByCaptions(frame)),
    }));
    const framesByLayer: Array<{ readonly layer: CaptionLayer; readonly frames: ReadonlyArray<SubtitleFrame | null> }> = [];
    for (const { layer, source } of this.opened) {
      framesByLayer.push({ layer, frames: await source.framesFor(layerRequests) });
    }
    const topLayers = await this.paintTopLayers(requests);
    return bases.map((base, i) => (ctx) => {
      this.frameCompositor.compose(ctx, {
        frame: base,
        captions: this.captionsAt(framesByLayer, i),
        overlay: this.overlay,
        topLayer: topLayers[i] ?? null,
        blendCaptions: this.backdrop.showsFramePixels(),
        width: this.width,
        height: this.height,
      });
    });
  }

  private captionsAt(
    framesByLayer: ReadonlyArray<{ readonly layer: CaptionLayer; readonly frames: ReadonlyArray<SubtitleFrame | null> }>,
    index: number,
  ): CaptionLayerFrame[] {
    const captions: CaptionLayerFrame[] = [];
    for (const { layer, frames } of framesByLayer) {
      const frame = frames[index];
      if (frame) captions.push({ layer, frame });
    }
    return captions;
  }

  /**
   * What lies beneath the captions at this frame, which is what a caption
   * sampling the video must be handed: the frame with the overlay on it.
   * The top layer is still handed the frame without the overlay — it
   * cuts the actor out of the video, not out of the overlay.
   */
  private beneathCaptions(frame: DecodedVideoFrame): DecodedVideoFrame {
    return this.overlay === null ? frame : new OverlaidVideoFrame(frame, this.overlay);
  }

  /**
   * One per request, or all null when no top layer is configured. Kept
   * frame by frame because the top layer reads the frame it occludes
   * and has no batch of its own to amortize. Each is cut from what the
   * backdrop says it occludes, and lands the way the backdrop says.
   */
  private async paintTopLayers(
    requests: ReadonlyArray<FramePaintRequest>,
  ): Promise<Array<OverlayFrame | null>> {
    if (this.topLayer === null) return requests.map(() => null);
    const layers: Array<OverlayFrame | null> = [];
    for (const { frame } of requests) {
      const layer = await this.topLayer.frameAt(frame.timestamp, this.backdrop.cutFrom(frame));
      layers.push(layer === null ? null : this.backdrop.occluding(layer));
    }
    return layers;
  }

  end(): void {
    for (const { source } of this.opened) source.close();
    this.opened = [];
    this.topLayer?.close();
    this.overlay = null;
  }
}
