import type { OpenedPreviewSource } from '@core/preview/domain/OpenedPreviewSource';

/**
 * Opens a media blob for preview playback. Rejects when the source
 * has no video track or its video codec is not decodable in this
 * browser; the failure message is suitable for user-facing copy.
 */
export interface PreviewSourceLoader {
  open(source: Blob): Promise<OpenedPreviewSource>;
}
