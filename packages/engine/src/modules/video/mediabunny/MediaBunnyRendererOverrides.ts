import type { OverlayFrameRenderer } from '@modules/rendering/OverlayFrameRenderer';
import type { SubtitleFrameRenderer } from '@modules/rendering/SubtitleFrameRenderer';
import type { SpriteSheetProbeObserver } from '@modules/rendering/subtitle/SpriteSheetProbeObserver';
import type { VideoEncoderProbeObserver } from '@modules/video/mediabunny/encoder/VideoEncoderProbeObserver';
import type { VideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/VideoFrameDecoderFactory';

/**
 * Parts of `MediaBunnyRenderers` a caller replaces, or watches. Each one
 * left out is the engine's own.
 */
export interface MediaBunnyRendererOverrides {
  /**
   * Which decoders a render may drive the input through. Defaults to
   * WebCodecs, falling back to a `<video>` element for a codec WebCodecs
   * cannot decode.
   */
  readonly videoFrameDecoderFactory?: VideoFrameDecoderFactory;
  /** Told whenever the browser's default video encoder refuses the probe frame a render encodes first. */
  readonly videoEncoderProbeObserver?: VideoEncoderProbeObserver;
  /** Told how large a sprite sheet the browser rasterizes captions into, and why it settled on a smaller one. */
  readonly spriteSheetProbeObserver?: SpriteSheetProbeObserver;
  /**
   * Paints the captions of a render in place of the engine's renderer.
   * It knows no caption layers, so it paints every caption on the base
   * layer. Still frames keep the engine's renderer, which answers moments
   * in any order.
   */
  readonly subtitleFrameRenderer?: SubtitleFrameRenderer;
  /** Paints a job's `overlayHtml`, in renders and still frames alike. */
  readonly overlayFrameRenderer?: OverlayFrameRenderer;
}
