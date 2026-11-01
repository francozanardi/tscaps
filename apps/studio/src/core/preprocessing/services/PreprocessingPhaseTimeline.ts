import type { PreprocessingProgressPhase } from '@core/preprocessing/domain/PreprocessingProgressStatus';
import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type { TelemetryEventProperties } from '@shared/telemetry';

/**
 * Accumulates how long a preprocessing run spent in each progress
 * phase, by watching the phase the progress store publishes.
 *
 * Time is summed per phase rather than measured between first and
 * last sighting, so a phase that is entered, left and entered again
 * reports the work it did and not the gap in between.
 *
 * What each phase means depends on which transcriber is running, and
 * the reported durations follow: `inferring` covers an on-device
 * model's inference on one surface and the wait on a remote
 * transcription call on another.
 *
 * `preview-proxy` is deliberately absent from the reported payload.
 * Proxy encoding can start while an earlier phase is still on screen,
 * so the phase's own span measures the tail the user waited on rather
 * than the work performed — a caller wanting the latter has to time
 * the encode itself.
 */
export class PreprocessingPhaseTimeline {
  private static readonly REPORTED_PHASES: readonly PreprocessingProgressPhase[] = [
    'converting',
    'audio-extract',
    'model-download',
    'inferring',
  ];

  private readonly elapsedByPhase = new Map<PreprocessingProgressPhase, number>();
  private readonly onStoreChange = () => this.syncWithStore();
  private currentPhase: PreprocessingProgressPhase | null = null;
  private currentPhaseStartedAt = 0;

  constructor(private readonly progressStore: PreprocessingProgressStore) {}

  /** Begins watching. The phase the store already sits on counts from this moment. */
  start(): void {
    this.progressStore.addEventListener('change', this.onStoreChange);
    this.syncWithStore();
  }

  /** Stops watching and closes the open phase. Safe to call more than once. */
  stop(): void {
    this.progressStore.removeEventListener('change', this.onStoreChange);
    this.closeCurrentPhase();
    this.currentPhase = null;
  }

  toTelemetryProperties(): TelemetryEventProperties {
    const properties: TelemetryEventProperties = {};
    for (const phase of PreprocessingPhaseTimeline.REPORTED_PHASES) {
      const elapsedMs = this.elapsedByPhase.get(phase);
      if (elapsedMs !== undefined) properties[this.propertyNameFor(phase)] = Math.round(elapsedMs);
    }
    return properties;
  }

  private syncWithStore(): void {
    const phase = this.progressStore.status.phase;
    if (phase === this.currentPhase) return;
    this.closeCurrentPhase();
    this.currentPhase = phase;
    this.currentPhaseStartedAt = performance.now();
  }

  private closeCurrentPhase(): void {
    if (this.currentPhase === null) return;
    const previous = this.elapsedByPhase.get(this.currentPhase) ?? 0;
    const elapsed = performance.now() - this.currentPhaseStartedAt;
    this.elapsedByPhase.set(this.currentPhase, previous + elapsed);
  }

  private propertyNameFor(phase: PreprocessingProgressPhase): string {
    return `${phase.replaceAll('-', '_')}_ms`;
  }
}
