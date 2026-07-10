import type { Transcriber } from '@tscaps/engine';
import type { PreprocessingProgressPhase } from '@core/preprocessing/domain/PreprocessingProgressStatus';

/**
 * Adds a per-instance opaque config setter and a declared initial phase to
 * the engine's `Transcriber` contract.
 *
 * `initialPhase` is the first phase this transcriber enters at the start of a
 * run.
 *
 * `setConfig` accepts an opaque value whose shape is owned by the concrete
 * transcriber; this keeps the editor decoupled from any specific implementation.
 */
export interface ConfigurableTranscriber extends Transcriber {
  readonly initialPhase: PreprocessingProgressPhase;
  setConfig(config: unknown): void;
}
