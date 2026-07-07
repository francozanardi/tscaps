export type PreprocessingProgressPhase = 'model-download' | 'audio-extract' | 'inferring' | 'preview-proxy' | 'complete';

/**
 * Snapshot of a transcription in progress.
 *
 * - `active` is `true` from `start()` until the next `cancel()` or store reset.
 * - `initialPhase` is the first phase of the run, as declared by the
 *   transcriber that executes it; `null` only when idle.
 * - `phase` advances forward (`initialPhase` → `inferring` →
 *   `preview-proxy` → `complete`) and never goes backwards within a
 *   run.
 * - `rawProgress` carries the underlying-step progress in `[0, 1]`. Its meaning
 *   depends on `phase` (download fraction, extract fraction, …). Smoothed
 *   visual percent for the UI is computed downstream — this is the raw datum.
 */
export interface PreprocessingProgressStatus {
  readonly active: boolean;
  readonly initialPhase: PreprocessingProgressPhase | null;
  readonly phase: PreprocessingProgressPhase | null;
  readonly rawProgress: number;
}
