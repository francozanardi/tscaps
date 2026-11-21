import type { Document } from '@modules/document/Document';
import type { OverlayFrameRenderer } from '@modules/rendering/OverlayFrameRenderer';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { FrameCompositor } from '@modules/video/mediabunny/frame/FrameCompositor';
import type { SubtitleLayerSourceFactory } from '@modules/video/mediabunny/caption/SubtitleLayerSourceFactory';
import type { TopLayerSource } from '@modules/video/mediabunny/painter/TopLayerSource';
import type { FrameBackdrop } from '@modules/video/mediabunny/painter/FrameBackdrop';
import { RenderJobFramePainter } from '@modules/video/mediabunny/painter/RenderJobFramePainter';
import type { CaptionLayerDemand } from '@modules/rendering/CaptionLayerDemand';
import type { FootageCompositor } from '@modules/video/FootageCompositor';
import type { FootageOpener } from '@modules/video/mediabunny/footage/FootageOpener';
import { MediaBunnyFootageFrameComposer } from '@modules/video/mediabunny/footage/MediaBunnyFootageFrameComposer';
import type { RenderFootage } from '@modules/video/RenderJob';
import type { FootageLayerResolverFactory } from '@modules/video/stage/FootageLayerResolverFactory';

/**
 * Builds a fresh {@link RenderJobFramePainter} bound to a
 * specific document, style set, (optional) overlay HTML, an (optional)
 * top-layer source, the backdrop the frames are painted on, and the
 * footage layers drawn on the source, if any. The factory owns the
 * shared, engine-wide dependencies (what builds a caption source per
 * layer, overlay renderer, compositors, what opens footage and what
 * resolves how it is drawn); each call
 * to {@link create} returns a single-use painter for one transcode run.
 */
export class RenderJobFramePainterFactory {

  constructor(
    private readonly layerSources: SubtitleLayerSourceFactory,
    private readonly layerDemand: CaptionLayerDemand,
    private readonly overlayRenderer: OverlayFrameRenderer,
    private readonly frameCompositor: FrameCompositor,
    private readonly footageOpener: FootageOpener,
    private readonly footageCompositor: FootageCompositor,
    private readonly footageResolvers: FootageLayerResolverFactory,
  ) {}

  create(
    document: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    overlayHtml: string | undefined,
    topLayer: TopLayerSource | null,
    backdrop: FrameBackdrop,
    footage: RenderFootage | null = null,
  ): RenderJobFramePainter {
    return new RenderJobFramePainter(
      this.layerSources,
      this.layerDemand,
      this.overlayRenderer,
      this.frameCompositor,
      document,
      styles,
      overlayHtml,
      topLayer,
      footage !== null
        ? new MediaBunnyFootageFrameComposer(
          footage.layers,
          footage.style,
          this.footageResolvers,
          this.footageOpener,
          this.footageCompositor,
          footage.grade,
        )
        : null,
      backdrop,
    );
  }
}
