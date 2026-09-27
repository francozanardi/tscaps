/** A validator's answer about one video. */
export type VideoValidationResult =
  | { readonly state: 'accepted' }
  | { readonly state: 'rejected'; readonly details: VideoRejectionDetails };

/**
 * Why a video was refused. Discriminated so a new reason can be added
 * without breaking consumers that render only the ones they know.
 */
export type VideoRejectionDetails =
  | { readonly type: 'over-cap'; readonly capSeconds: number; readonly videoDurationSeconds: number }
  | { readonly type: 'unreadable'; readonly reason: UnreadableReason };

/**
 * Why a video could not be measured, which decides what the visitor
 * is asked to do about it: `source-unreadable` means the runtime
 * refused the bytes, so only picking the file again helps;
 * `container-unreadable` means the bytes arrived and nothing in them
 * parsed as a video.
 */
export type UnreadableReason = 'source-unreadable' | 'container-unreadable';
