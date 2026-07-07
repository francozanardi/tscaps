/**
 * A half-open source-time window the preview must skip during
 * playback. The end is exclusive: a sample at `endSec` plays.
 */
export interface PreviewCutRange {
  readonly startSec: number;
  readonly endSec: number;
}

/**
 * Read-and-listen handle over the live set of cut ranges that the
 * preview surface honours. The surface reads {@link getRanges} on
 * demand to build its time map and registers a listener via
 * {@link onRangesChanged} so it can re-anchor its playback clock
 * the instant the ranges change.
 *
 * The returned unregister function detaches the listener; the
 * surface calls it on stop.
 */
export interface PreviewCutsSource {
  getRanges(): ReadonlyArray<PreviewCutRange>;
  onRangesChanged(listener: () => void): () => void;
}
