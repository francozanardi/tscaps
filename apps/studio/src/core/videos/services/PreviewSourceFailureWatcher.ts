import type { PreviewLoadFailure, VideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';
import type { RecoverPreviewSourceAction } from '@core/videos/actions/RecoverPreviewSourceAction';

/**
 * Starts looking for another copy of the original each time the
 * preview surface reports that its source stopped reading. A failure
 * the browser has with the bytes themselves (`unplayable`) is left to
 * the player: every copy of the same video fails it the same way.
 *
 * Each failure the surface reports is acted on once, however many
 * changes the surface announces while it stands.
 */
export class PreviewSourceFailureWatcher {
  private handledFailure: PreviewLoadFailure | null = null;

  constructor(
    private readonly surface: VideoPreviewSurface,
    private readonly recoverPreviewSource: RecoverPreviewSourceAction,
  ) {}

  install(): void {
    this.surface.addEventListener('change', this.onSurfaceChange);
  }

  uninstall(): void {
    this.surface.removeEventListener('change', this.onSurfaceChange);
  }

  private readonly onSurfaceChange = (): void => {
    const failure = this.surface.snapshot().loadFailure;
    if (failure === null || failure === this.handledFailure || failure.reason !== 'source-unreadable') return;
    this.handledFailure = failure;
    void this.recoverPreviewSource.execute();
  };
}
