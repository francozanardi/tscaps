import type { PreprocessingProgressPhase, PreprocessingProgressStatus } from '@core/preprocessing/domain/PreprocessingProgressStatus';

/**
 * Observable container for the raw progress of an in-flight
 * preprocessing run. Covers every phase from model download through
 * preview-proxy generation.
 *
 * Holds facts only — `active`, `initialPhase`, current `phase`, and
 * the raw `rawProgress` of that phase in `[0, 1]`. No timing curves,
 * no smoothing. Visual smoothing for the user-facing progress bar
 * lives downstream; this store is independent of the editor store
 * so per-tick writes do not invalidate the editor snapshot.
 *
 * `setPreviewProxyProgress` is safe to call before
 * `enterPreviewProxyPhase` — it keeps the most recent value buffered
 * and the phase transition publishes that buffered value as the
 * starting `rawProgress`. This lets the proxy encoder report
 * progress while an earlier phase (transcribe) is still active
 * without that progress overriding the active phase prematurely.
 *
 * Subscribers listen for the `'change'` event and read `status`.
 */
export class PreprocessingProgressStore extends EventTarget {
  private static readonly IDLE: PreprocessingProgressStatus = {
    active: false,
    initialPhase: null,
    phase: null,
    rawProgress: 0,
  };

  private static readonly PHASE_ORDER: Record<PreprocessingProgressPhase, number> = {
    'model-download': 0,
    'audio-extract': 1,
    'inferring': 2,
    'preview-proxy': 3,
    'complete': 4,
  };

  private _status: PreprocessingProgressStatus = PreprocessingProgressStore.IDLE;
  private bufferedPreviewProxyProgress = 0;

  get status(): PreprocessingProgressStatus {
    return this._status;
  }

  /**
   * Returns `true` when the current phase has progressed strictly
   * past the given one. Order-based so callers ask "is X already
   * over?" without enumerating the phases that come after it —
   * inserting a new phase between existing ones keeps the answer
   * correct without touching the caller.
   *
   * Returns `false` while the store is idle (no phase set yet).
   */
  isPhasePast(phase: PreprocessingProgressPhase): boolean {
    const current = this._status.phase;
    if (current === null) return false;
    return PreprocessingProgressStore.PHASE_ORDER[current] > PreprocessingProgressStore.PHASE_ORDER[phase];
  }

  /** Marks the start of a run. `initialPhase` is the first phase the transcriber will enter. */
  start(initialPhase: PreprocessingProgressPhase): void {
    this.bufferedPreviewProxyProgress = 0;
    this.publish({ active: true, initialPhase, phase: initialPhase, rawProgress: 0 });
  }

  setModelDownloadProgress(progress: number): void {
    if (!this._status.active) return;
    this.publish({ phase: 'model-download', rawProgress: this.clamp01(progress) });
  }

  setAudioExtractProgress(progress: number): void {
    if (!this._status.active) return;
    this.publish({ phase: 'audio-extract', rawProgress: this.clamp01(progress) });
  }

  enterInferringPhase(): void {
    if (!this._status.active) return;
    if (this._status.phase === 'inferring') return;
    this.publish({ phase: 'inferring', rawProgress: 0 });
  }

  enterPreviewProxyPhase(): void {
    if (!this._status.active) return;
    if (this._status.phase === 'preview-proxy') return;
    this.publish({ phase: 'preview-proxy', rawProgress: this.bufferedPreviewProxyProgress });
  }

  setPreviewProxyProgress(progress: number): void {
    if (!this._status.active) return;
    const clamped = this.clamp01(progress);
    this.bufferedPreviewProxyProgress = clamped;
    if (this._status.phase !== 'preview-proxy') return;
    this.publish({ rawProgress: clamped });
  }

  markComplete(): void {
    if (!this._status.active) return;
    this.publish({ phase: 'complete', rawProgress: 1 });
  }

  cancel(): void {
    if (!this._status.active) return;
    this.bufferedPreviewProxyProgress = 0;
    this.publish(PreprocessingProgressStore.IDLE);
  }

  private publish(patch: Partial<PreprocessingProgressStatus>): void {
    this._status = { ...this._status, ...patch };
    this.dispatchEvent(new Event('change'));
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
