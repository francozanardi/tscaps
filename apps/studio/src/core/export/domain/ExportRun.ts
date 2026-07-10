/**
 * Reason an export is currently paused waiting on a user decision.
 *
 * `fallback-decoder`: the chosen video decoder failed for the input
 * codec, and the renderer needs a confirmation before falling back to
 * a slower path.
 */
export type ExportPauseReason =
  | { readonly kind: 'fallback-decoder'; readonly codec: string };

/**
 * Where in the export lifecycle a run currently sits.
 *
 * - `awaiting-original`: the original-video bytes are still being
 *   fetched from the project's backing store; the renderer cannot
 *   start until they land.
 * - `rendering`: the renderer is producing frames and writing to the
 *   output stream.
 */
export type ExportRunPhase = 'awaiting-original' | 'rendering';

/**
 * Snapshot of an export currently in flight. `pause` is non-null only
 * while the pipeline is suspended awaiting a user decision.
 */
export interface ExportRun {
  readonly phase: ExportRunPhase;
  readonly pause: ExportPauseReason | null;
}
