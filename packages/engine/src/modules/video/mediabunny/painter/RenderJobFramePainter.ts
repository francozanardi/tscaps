import type { Document } from '@modules/document/Document';
import type { OverlayFrame, OverlayFrameRenderer } from '@modules/rendering/OverlayFrameRenderer';
import type { SubtitleFrame, SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { FrameCompositor } from '@modules/video/mediabunny/frame/FrameCompositor';
import type { SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';
import type { SubtitleLayerSourceFactory } from '@modules/video/mediabunny/caption/SubtitleLayerSourceFactory';
import type { CaptionLayerFrame } from '@modules/video/mediabunny/frame/FrameCompositor';
import type { TopLayerSource } from '@modules/video/mediabunny/painter/TopLayerSource';
import type { ComposedFootageFrame, FootageFrameComposer } from '@modules/video/mediabunny/footage/FootageFrameComposer';
import { FootageFramedOverlayFrame } from '@modules/video/mediabunny/painter/FootageFramedOverlayFrame';
import type { FrameBackdrop } from '@modules/video/mediabunny/painter/FrameBackdrop';
import type { PaintFrame } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';
import type { FramePainter, FramePaintRequest } from '@modules/video/mediabunny/painter/FramePainter';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { OverlaidVideoFrame } from '@modules/video/mediabunny/frame/OverlaidVideoFrame';
import type { CaptionLayerDemand } from '@modules/rendering/CaptionLayerDemand';
import { CaptionLayer } from '@modules/rendering/types/CaptionLayer';
import { SourcePicturePlacement } from '@modules/video/SourcePicturePlacement';

/**
 * Caption ticks step at the source's frame rate up to this cap. Past
 * it, per-letter or per-word animations gain nothing from extra renders
 * (the eye doesn't resolve sub-30fps differences in caption motion) and
 * the per-batch subtitle decode dominates the render budget.
 */
const CAPTION_FPS_CAP = 30;

/** A frame as shown, with what lies beneath its backdrops and where the source's own picture landed. */
interface ShownFrame extends Omit<ComposedFootageFrame, 'frame'> {
  readonly frame: DecodedVideoFrame;
}

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
 * Where footage layers are active, the frame they compose on the
 * source frame replaces it before anything reads it, so the captions
 * and the top layer see the picture that is shown. Where backdrop
 * layers draw that picture again, the top layer is cut from the frame
 * beneath them and drawn in their states, so it moves and fades with
 * the picture rather than standing still over it.
 *
 * Runs come in whatever order the caption sources its factory builds
 * accept: in advancing time for the sources a transcode uses, in any
 * order for sources that answer any moment. The footage composer serves
 * any order, and the top layer is asked in the order runs come.
 *
 * Single-use: one open/close cycle per instance. Build a fresh one for
 * each transcode run, or each still-frame session, through the factory.
 */
export class RenderJobFramePainter implements FramePainter {

  private width = 0;
  private height = 0;
  private sourceWidth = 0;
  private sourceHeight = 0;
  private overlay: OverlayFrame | null = null;
  /** The sources opened for this run, in paint order. */
  private opened: Array<{ readonly layer: CaptionLayer; readonly source: SubtitleLayerSource }> = [];
  /** The composed frames handed out by the last run, closed once it has been encoded. */
  private composedFrames: DecodedVideoFrame[] = [];

  constructor(
    private readonly layerSources: SubtitleLayerSourceFactory,
    private readonly layerDemand: CaptionLayerDemand,
    private readonly overlayRenderer: OverlayFrameRenderer,
    private readonly frameCompositor: FrameCompositor,
    private readonly document: Document,
    private readonly styles: Readonly<Record<string, SubtitleStyle>>,
    private readonly overlayHtml: string | undefined,
    private readonly topLayer: TopLayerSource | null,
    private readonly footage: FootageFrameComposer | null,
    private readonly backdrop: FrameBackdrop,
  ) {}

  async begin(width: number, height: number, fps: number, sourceWidth: number, sourceHeight: number): Promise<void> {
    this.width = width;
    this.height = height;
    this.sourceWidth = sourceWidth;
    this.sourceHeight = sourceHeight;
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
    if (this.footage !== null) {
      await this.footage.open(width, height, sourceWidth, sourceHeight);
    }
  }

  lookAhead(): number {
    return Math.max(1, ...this.opened.map(({ source }) => source.lookAhead()));
  }

  async paint(requests: ReadonlyArray<FramePaintRequest>): Promise<PaintFrame[]> {
    // The coordinator paints a run only once the one before it is encoded.
    this.closeComposedFrames();
    const composed = await this.framesShown(requests);
    const shown = composed.map(({ frame }) => frame);
    const bases = shown.map((frame) => this.backdrop.beneath(frame));
    const layerRequests = shown.map((frame) => ({
      time: frame.timestamp,
      videoFrame: this.beneathCaptions(this.backdrop.sampledByCaptions(frame)),
    }));
    const framesByLayer: Array<{ readonly layer: CaptionLayer; readonly frames: ReadonlyArray<SubtitleFrame | null> }> = [];
    for (const { layer, source } of this.opened) {
      framesByLayer.push({ layer, frames: await source.framesFor(layerRequests) });
    }
    const topLayers = await this.paintTopLayers(composed);
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

  /**
   * The frame each request shows — the one its footage layers compose, or
   * the source's where none is active — with what lies beneath its
   * backdrops and where the source's picture landed.
   */
  private async framesShown(requests: ReadonlyArray<FramePaintRequest>): Promise<ShownFrame[]> {
    // Footage is part of the picture: a backdrop that shows none of it shows none of the footage either.
    if (this.footage === null || !this.backdrop.showsFramePixels()) {
      const asIs = SourcePicturePlacement.asIs(this.width, this.height, this.sourceWidth, this.sourceHeight);
      return requests.map(({ frame }) => ({ frame, sourcePicture: asIs, beneathBackdrops: null }));
    }
    const shown: ShownFrame[] = [];
    for (const { frame, outputTimestamp } of requests) {
      const composed = await this.footage.frameFor(outputTimestamp, frame);
      if (composed.frame !== null) this.composedFrames.push(composed.frame);
      if (composed.beneathBackdrops !== null) this.composedFrames.push(composed.beneathBackdrops.frame);
      shown.push({ ...composed, frame: composed.frame ?? frame });
    }
    return shown;
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
   * One per frame, or all null when no top layer is configured. Kept
   * frame by frame because the top layer reads the frame it occludes
   * and has no batch of its own to amortize. Each is cut from what the
   * backdrop says it occludes, and lands the way the backdrop says;
   * where backdrop footage layers drew the picture again, it is cut from
   * the frame beneath them and drawn in their states.
   */
  private async paintTopLayers(
    frames: ReadonlyArray<ShownFrame>,
  ): Promise<Array<OverlayFrame | null>> {
    if (this.topLayer === null) return frames.map(() => null);
    const layers: Array<OverlayFrame | null> = [];
    for (const { frame, sourcePicture, beneathBackdrops } of frames) {
      const cutFrom = beneathBackdrops?.frame ?? frame;
      const layer = await this.topLayer.frameAt(frame.timestamp, this.backdrop.cutFrom(cutFrom), sourcePicture);
      const occluding = layer === null ? null : this.backdrop.occluding(layer);
      layers.push(occluding === null || beneathBackdrops === null
        ? occluding
        : new FootageFramedOverlayFrame(occluding, beneathBackdrops.states, this.width, this.height));
    }
    return layers;
  }

  private closeComposedFrames(): void {
    for (const frame of this.composedFrames) frame.close();
    this.composedFrames = [];
  }

  end(): void {
    for (const { source } of this.opened) source.close();
    this.opened = [];
    this.topLayer?.close();
    this.closeComposedFrames();
    void this.footage?.close();
    this.overlay = null;
  }
}
