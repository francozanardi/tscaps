/**
 * Domain-level answer to "can this loaded video be preprocessed?".
 * Every consumer that gates the flow — the start dialog, the
 * PreprocessVideoAction, the rejection telemetry reporter — reads
 * the same status so the decision cannot drift between them.
 *
 * The `rejected` state carries a discriminated `details` payload so
 * new rejection reasons (unsupported codec, file too large, ...) can
 * be added without breaking existing consumers.
 */
export type VideoValidationStatus =
  | { readonly state: 'no-video' }
  | { readonly state: 'analyzing' }
  | { readonly state: 'accepted' }
  | { readonly state: 'rejected'; readonly details: VideoRejectionDetails };

export type VideoRejectionDetails =
  | { readonly type: 'over-cap'; readonly capSeconds: number; readonly videoDurationSeconds: number }
  | { readonly type: 'unreadable'; readonly reason: UnreadableReason };

/**
 * Why a loaded video could not be measured, which decides what the
 * visitor is asked to do about it.
 *
 * `source-unreadable` means the runtime refused to hand over the
 * file's bytes — converting the file cannot help, picking it again
 * can. `container-unreadable` means the bytes arrived and nothing in
 * them could be parsed as a video.
 */
export type UnreadableReason = 'source-unreadable' | 'container-unreadable';
