import type { Document } from '@modules/document/Document';
import type { OverlayFrameRenderer } from '@modules/rendering/OverlayFrameRenderer';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { FrameCompositor } from '@modules/video/mediabunny/frame/FrameCompositor';
import type { SubtitleLayerSourceFactory } from '@modules/video/mediabunny/caption/SubtitleLayerSourceFactory';
import type { TopLayerSource } from '@modules/video/mediabunny/painter/TopLayerSource';
import type { FrameBackdrop } from '@modules/video/mediabunny/painter/FrameBackdrop';
import { CaptionsOverlayFramePainter } from '@modules/video/mediabunny/painter/CaptionsOverlayFramePainter';
import type { CaptionLayerDemand } from '@modules/rendering/CaptionLayerDemand';

/**
 * Builds a fresh {@link CaptionsOverlayFramePainter} bound to a
 * specific document, style set, (optional) overlay HTML, an (optional)
 * top-layer source, and the backdrop the frames are painted on. The
 * factory owns the shared, engine-wide dependencies (what builds a
 * caption source per layer, overlay renderer, compositor); each call to
 * {@link create} returns a single-use painter for one transcode run.
 */
export class CaptionsOverlayFramePainterFactory {

  constructor(
    private readonly layerSources: SubtitleLayerSourceFactory,
    private readonly layerDemand: CaptionLayerDemand,
    private readonly overlayRenderer: OverlayFrameRenderer,
    private readonly frameCompositor: FrameCompositor,
  ) {}

  create(
    document: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    overlayHtml: string | undefined,
    topLayer: TopLayerSource | null,
    backdrop: FrameBackdrop,
  ): CaptionsOverlayFramePainter {
    return new CaptionsOverlayFramePainter(
      this.layerSources,
      this.layerDemand,
      this.overlayRenderer,
      this.frameCompositor,
      document,
      styles,
      overlayHtml,
      topLayer,
      backdrop,
    );
  }
}
