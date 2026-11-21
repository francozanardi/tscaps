/**
 * Reason an export is currently paused waiting on a user decision.
 *
 * `fallback-decoder`: the chosen video decoder failed for the input
 * codec, and the renderer needs a confirmation before falling back to
 * a slower path.
 *
 * `footage-unavailable`: files meant to show over the video could not
 * be had, and the export goes on without them only if confirmed.
 *
 * `audio-unavailable`: sound files the soundtrack plays could not be
 * had, and the export goes on without them only if confirmed.
 */
export type ExportPauseReason =
  | { readonly kind: 'fallback-decoder'; readonly codec: string }
  | { readonly kind: 'footage-unavailable'; readonly fileNames: ReadonlyArray<string> }
  | { readonly kind: 'audio-unavailable'; readonly fileNames: ReadonlyArray<string> };

/**
 * Where in the export lifecycle a run currently sits.
 *
 * - `awaiting-footage`: the files shown over the video, or the sounds
 *   mixed with it, are being fetched; the render cannot be planned
 *   until they land.
 * - `awaiting-original`: the original-video bytes are still being
 *   fetched from the project's backing store; the renderer cannot
 *   start until they land.
 * - `rendering`: the renderer is producing frames and writing to the
 *   output stream.
 */
export type ExportRunPhase = 'awaiting-footage' | 'awaiting-original' | 'rendering';

/**
 * Why a run was abandoned before it produced a file.
 *
 * - `user`: the reader stopped it, by dismissing a prompt the run
 *   raised or by declining to continue at a pause.
 * - `declined-missing-files`: the reader declined to go on without
 *   files the run could not use.
 */
export type ExportCancelReason =
  | 'user'
  | 'declined-missing-files'
  ;

/**
 * Snapshot of an export currently in flight. `pause` is non-null only
 * while the pipeline is suspended awaiting a user decision.
 */
export interface ExportRun {
  readonly phase: ExportRunPhase;
  readonly pause: ExportPauseReason | null;
}
