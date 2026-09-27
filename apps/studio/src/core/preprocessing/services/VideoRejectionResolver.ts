import type { EditorStore } from '@core/editor/store/EditorStore';
import type { AppError } from '@core/errors/domain/AppError';
import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { VideoValidator } from '@core/videos/domain/VideoValidator';
import { VideoDurationUnreadableError } from '@core/videos/domain/errors/VideoDurationUnreadableError';

/**
 * Turns the rules' verdict on the loaded video into the error a flow
 * should show, or `null` when it may go on. Reports every refusal it
 * resolves — a caller that shows one to the visitor itself must not
 * use this.
 *
 * A rule whose source could not be read refuses the video rather than
 * waving it through — an unreadable cap is not an absent one — and
 * its cause is preserved for the rendering boundary to word.
 */
export class VideoRejectionResolver {
  constructor(
    private readonly store: EditorStore,
    private readonly validator: VideoValidator,
    private readonly errorClassifier: AppErrorClassifier,
  ) {}

  /**
   * Judges the video the editor holds by `durationSeconds`, which the
   * caller supplies because the metadata probe reads a more accurate
   * one than the editor state carries.
   */
  async resolve(durationSeconds: number): Promise<AppError | null> {
    const { video } = this.store.snapshot();
    try {
      const result = await this.validator.validate({
        durationSeconds,
        isSourceReadable: video.isSourceReadable,
      });
      if (result.state === 'accepted') return null;
      return new VideoDurationUnreadableError({
        fileName: video.fileName,
        mimeType: video.mimeType,
        size: video.size,
      });
    } catch (err) {
      return this.errorClassifier.wrap(err);
    }
  }
}
