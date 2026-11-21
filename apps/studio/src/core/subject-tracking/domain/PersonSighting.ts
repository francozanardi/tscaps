import type { SeenPerson } from '@core/subject-tracking/domain/SeenPerson';

/** What found a person: their body's landmarks, or only their face. */
export type SightingSource = 'pose' | 'face';

/**
 * One person seen in one frame, and what found them. `headHeight` is how
 * tall their head is, crown to chin, as a share of the picture's height:
 * an estimate from the face, null where too little of it was seen.
 */
export interface PersonSighting extends SeenPerson {
  readonly source: SightingSource;
  readonly headHeight: number | null;
}
