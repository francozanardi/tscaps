import type { TranscribePhase, TranscribeStatus } from '@core/transcription/domain/TranscribeStatus';
import type { TranscribeProgressStore } from '@core/transcription/store/TranscribeProgressStore';

export interface TranscribeProgressView {
  readonly active: boolean;
  readonly initialPhase: TranscribePhase | null;
  readonly phase: TranscribePhase | null;
  /** Smoothed visual progress in `[0, 1]`. Never decreases within a run. */
  readonly percent: number;
}

/**
 * Reads the raw transcription progress from its store and emits a
 * smoothed visual percent for the progress bar.
 *
 * Mapping per phase:
 * - `model-download` → leads up to 40% of the bar.
 * - `audio-extract` → leads up to 30% of the bar.
 * - `inferring` → an asymptotic time-based curve climbs from the
 *   previous ceiling toward 95% (real inference progress is not
 *   surfaced by the underlying pipelines).
 * - `complete` → snaps to 100%.
 *
 * Lives outside the store so per-tick smoothing does not bloat the
 * data model. Subscribers listen for `'change'` and read `view`.
 */
export class TranscribeProgressController extends EventTarget {
  private static readonly MODEL_DOWNLOAD_CEILING = 0.4;
  private static readonly AUDIO_EXTRACT_CEILING = 0.3;
  private static readonly INFERRING_CEILING = 0.95;

  // Calibrated so the preprocess wall-clock (transcribe + builtin
  // tagging, both inside one response) lands near 60-70% of the bar
  // before the response arrives: fast enough to feel responsive, slow
  // enough that long jobs do not max out early.
  private static readonly INFERRING_TIME_CONSTANT_MS = 28_000;
  private static readonly INFERRING_TICK_MS = 100;

  private static readonly IDLE: TranscribeProgressView = {
    active: false,
    initialPhase: null,
    phase: null,
    percent: 0,
  };

  private _view: TranscribeProgressView = TranscribeProgressController.IDLE;
  private inferringTickHandle: number | null = null;
  private inferringStartedAt: number | null = null;

  constructor(private readonly store: TranscribeProgressStore) {
    super();
  }

  start(): void {
    this.store.addEventListener('change', this.handleStoreChange);
    this.recomputeFromStore();
  }

  stop(): void {
    this.store.removeEventListener('change', this.handleStoreChange);
    this.stopInferringTicker();
  }

  get view(): TranscribeProgressView {
    return this._view;
  }

  private readonly handleStoreChange = (): void => {
    this.recomputeFromStore();
  };

  private recomputeFromStore(): void {
    const status = this.store.status;
    if (!status.active) {
      this.transitionToIdle();
      return;
    }
    if (status.phase === 'inferring') {
      this.ensureInferringTicker();
      this.publishInferringPercent();
      return;
    }
    this.stopInferringTicker();
    this.publishFromNonInferringPhase(status);
  }

  private transitionToIdle(): void {
    this.stopInferringTicker();
    this.publish(TranscribeProgressController.IDLE);
  }

  private ensureInferringTicker(): void {
    if (this.inferringTickHandle !== null) return;
    this.inferringStartedAt = performance.now();
    this.inferringTickHandle = window.setInterval(
      () => this.publishInferringPercent(),
      TranscribeProgressController.INFERRING_TICK_MS,
    );
  }

  private stopInferringTicker(): void {
    if (this.inferringTickHandle === null) return;
    window.clearInterval(this.inferringTickHandle);
    this.inferringTickHandle = null;
    this.inferringStartedAt = null;
  }

  private publishInferringPercent(): void {
    if (this.inferringStartedAt === null) return;
    const status = this.store.status;
    const floor = this.inferringFloorFor(status.initialPhase);
    const span = TranscribeProgressController.INFERRING_CEILING - floor;
    const elapsed = performance.now() - this.inferringStartedAt;
    const ratio = 1 - Math.exp(-elapsed / TranscribeProgressController.INFERRING_TIME_CONSTANT_MS);
    this.publish({
      active: status.active,
      initialPhase: status.initialPhase,
      phase: 'inferring',
      percent: floor + span * ratio,
    });
  }

  private publishFromNonInferringPhase(status: TranscribeStatus): void {
    this.publish({
      active: status.active,
      initialPhase: status.initialPhase,
      phase: status.phase,
      percent: this.smoothedPercentFor(status),
    });
  }

  private smoothedPercentFor(status: TranscribeStatus): number {
    if (status.phase === 'model-download') {
      return status.rawProgress * TranscribeProgressController.MODEL_DOWNLOAD_CEILING;
    }
    if (status.phase === 'audio-extract') {
      return status.rawProgress * TranscribeProgressController.AUDIO_EXTRACT_CEILING;
    }
    if (status.phase === 'complete') {
      return 1;
    }
    return 0;
  }

  private inferringFloorFor(initialPhase: TranscribePhase | null): number {
    if (initialPhase === 'audio-extract') return TranscribeProgressController.AUDIO_EXTRACT_CEILING;
    return TranscribeProgressController.MODEL_DOWNLOAD_CEILING;
  }

  private publish(next: TranscribeProgressView): void {
    this._view = next;
    this.dispatchEvent(new Event('change'));
  }
}
