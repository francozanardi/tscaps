import type { Document } from '@modules/document/Document';
import type { OverlayFrameRenderer } from '@modules/rendering/OverlayFrameRenderer';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { FrameCompositor } from '@modules/video/mediabunny/frame/FrameCompositor';
import type { SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';
import { CaptionsOverlayFramePainter } from '@modules/video/mediabunny/painter/CaptionsOverlayFramePainter';

/**
 * Builds a fresh {@link CaptionsOverlayFramePainter} bound to a
 * specific document, style set, and (optional) overlay HTML. The
 * factory owns the shared, engine-wide dependencies (subtitle source,
 * overlay renderer, compositor); each call to {@link create} returns a
 * single-use painter for one transcode run.
 */
export class CaptionsOverlayFramePainterFactory {

  constructor(
    private readonly subtitleLayer: SubtitleLayerSource,
    private readonly overlayRenderer: OverlayFrameRenderer,
    private readonly frameCompositor: FrameCompositor,
  ) {}

  create(
    document: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    overlayHtml: string | undefined,
  ): CaptionsOverlayFramePainter {
    return new CaptionsOverlayFramePainter(
      this.subtitleLayer,
      this.overlayRenderer,
      this.frameCompositor,
      document,
      styles,
      overlayHtml,
    );
  }
}
