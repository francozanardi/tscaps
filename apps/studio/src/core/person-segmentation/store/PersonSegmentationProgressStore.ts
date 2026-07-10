import type { PersonSegmentationPhase, PersonSegmentationProgress } from '@core/person-segmentation/domain/PersonSegmentationProgress';

export interface PersonSegmentationProgressStatus {
  readonly active: boolean;
  readonly phase: PersonSegmentationPhase | null;
  readonly fraction: number;
}

/**
 * Observable container for the raw progress of a detector run. Holds
 * facts only — whether a run is active, its current `phase`, and the
 * fraction of that phase in `[0, 1]`. Subscribers listen for
 * `'change'` and read `status`. No timing curves, no smoothing.
 *
 * Kept independent of the editor store so per-tick writes do not
 * invalidate the editor snapshot.
 */
export class PersonSegmentationProgressStore extends EventTarget {
  private static readonly IDLE: PersonSegmentationProgressStatus = {
    active: false,
    phase: null,
    fraction: 0,
  };

  private currentStatus: PersonSegmentationProgressStatus = PersonSegmentationProgressStore.IDLE;

  get status(): PersonSegmentationProgressStatus {
    return this.currentStatus;
  }

  start(): void {
    this.publish({ active: true, phase: 'scanning', fraction: 0 });
  }

  updateProgress(progress: PersonSegmentationProgress): void {
    if (!this.currentStatus.active) return;
    this.publish({ phase: progress.phase, fraction: this.clamp01(progress.fraction) });
  }

  finish(): void {
    this.publish(PersonSegmentationProgressStore.IDLE);
  }

  private publish(patch: Partial<PersonSegmentationProgressStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...patch };
    this.dispatchEvent(new Event('change'));
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
