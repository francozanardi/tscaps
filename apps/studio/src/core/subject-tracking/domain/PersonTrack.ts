import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';

/** Where the followed person was in one frame; null where they were not found in it. */
export interface TrackStep {
  readonly sourceSec: number;
  readonly sighting: PersonSighting | null;
}

/** One person followed through frames, a step per frame looked at, in time order. */
export interface PersonTrack {
  readonly steps: ReadonlyArray<TrackStep>;
}
