import type { VideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';

/**
 * Pauses preview playback whenever the document becomes hidden.
 *
 * While the tab is hidden, `requestAnimationFrame` stops but the
 * playback clock keeps advancing — left playing, the decoder
 * would have to grind through the whole hidden gap at decode
 * speed once the tab returns, a burst of CPU and GPU work that
 * mobile devices cannot absorb. Pausing on hide keeps the clock
 * and the decode position together.
 *
 * Playback is never auto-resumed on return; the user resumes
 * manually.
 */
export class DocumentHiddenPlaybackPauser {

  constructor(private readonly surface: VideoPreviewSurface) {}

  install(): void {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  uninstall(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState !== 'hidden') return;
    if (this.surface.snapshot().isPlaying) this.surface.pause();
  };
}
