export type TranscribePhase = 'model-download' | 'audio-extract' | 'inferring' | 'complete';

/**
 * Snapshot of a transcription in progress.
 *
 * - `active` is `true` from `start()` until the next `cancel()` or store reset.
 * - `initialPhase` is the first phase of the run, as declared by the
 *   transcriber that executes it; `null` only when idle.
 * - `phase` advances forward (`initialPhase` → `inferring` → `complete`) and
 *   never goes backwards within a run.
 * - `rawProgress` carries the underlying-step progress in `[0, 1]`. Its meaning
 *   depends on `phase` (download fraction, extract fraction, …). Smoothed
 *   visual percent for the UI is computed downstream — this is the raw datum.
 */
export interface TranscribeStatus {
  readonly active: boolean;
  readonly initialPhase: TranscribePhase | null;
  readonly phase: TranscribePhase | null;
  readonly rawProgress: number;
}
