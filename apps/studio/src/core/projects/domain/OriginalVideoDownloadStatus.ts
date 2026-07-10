/**
 * Why the original-video download could not complete. Single value
 * today (network); kept as an explicit type so future reasons (e.g.
 * authorization expired, storage backend gone) can be added without
 * widening string literals across consumers.
 */
export type OriginalVideoDownloadFailureReason = 'network';

/**
 * Discriminated snapshot of the in-flight (or completed) original-
 * video fetch for the active project.
 *
 * - `idle`: no project loaded, or the source bytes were never
 *   requested.
 * - `downloading`: fetch is in flight. `progress` is `null` when the
 *   transport could not advertise a content length; otherwise it
 *   carries the received fraction in `[0, 1]`.
 * - `ready`: bytes landed and the editor store's `video.file` reflects
 *   them.
 * - `failed`: fetch ended in error. `reason` names the failure mode.
 */
export type OriginalVideoDownloadStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'downloading'; readonly progress: number | null }
  | { readonly kind: 'ready' }
  | { readonly kind: 'failed'; readonly reason: OriginalVideoDownloadFailureReason };
