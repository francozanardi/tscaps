import type { PreviewSurfaceVariant } from '@core/preview/domain/VideoPreviewSurface';

/**
 * Answers whether the current session can render the text-behind-actor
 * effect during editor playback. The effect needs to sample source
 * pixels from a canvas the surface owns, which only exists when the
 * canvas surface variant is active and the proxy pipeline is on. On
 * the native `<video>` surface or with the proxy pipeline off, the
 * canvas overlay path is not available and the effect stays off.
 */
export class BehindActorPreviewSupportChecker {

  constructor(
    private readonly proxyPipelineEnabled: boolean,
    private readonly surfaceVariant: PreviewSurfaceVariant,
  ) {}

  isSupported(): boolean {
    return this.proxyPipelineEnabled && this.surfaceVariant === 'canvas';
  }
}
