import type { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { ShotFileShowFailedError } from '@core/shots/domain/errors/ShotFileShowFailedError';

/**
 * Keeps off a shot any file this browser cannot play, so a shot never
 * holds a still standing in for a GIF. Only a GIF can be refused; a
 * video, a picture, and a file the catalog does not hold pass.
 */
export class ShotFilePlaybackCheck {
  constructor(
    private readonly media: MediaAssetStore,
    private readonly preparer: MediaAssetPreparer,
  ) {}

  /**
   * Resolves once `mediaId` is known to play here, waiting for a GIF's
   * check where it has not run yet. Rejects with a
   * {@link ShotFileShowFailedError} carrying why it cannot play.
   */
  async ensurePlayable(mediaId: string): Promise<void> {
    const file = this.media.snapshot().get(mediaId);
    if (file === null || file.type !== 'gif') return;
    await this.preparer.prepare(file);
    const status = this.preparer.statusOf(mediaId);
    if (status?.phase === 'unplayable') throw new ShotFileShowFailedError(mediaId, { cause: status.error });
  }
}
