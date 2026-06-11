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
 * Snapshot of an export currently in flight. `pause` is non-null only
 * while the pipeline is suspended awaiting a user decision.
 */
export interface ExportRun {
  readonly pause: ExportPauseReason | null;
}
