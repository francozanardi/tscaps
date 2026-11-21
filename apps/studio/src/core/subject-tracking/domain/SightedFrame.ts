import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';

/** Everyone seen in the frame shown at `sourceSec` of the source video; empty where nobody was. */
export interface SightedFrame {
  readonly sourceSec: number;
  readonly people: ReadonlyArray<PersonSighting>;
}
