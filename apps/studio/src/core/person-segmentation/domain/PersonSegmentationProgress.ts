export type PersonSegmentationPhase = 'scanning' | 'caching-masks';

/**
 * Snapshot of a detector run's progress: which phase is currently
 * executing and how far it has advanced through that phase. `fraction`
 * lives in `[0, 1]` and resets when the phase transitions.
 */
export interface PersonSegmentationProgress {
  readonly phase: PersonSegmentationPhase;
  readonly fraction: number;
}
