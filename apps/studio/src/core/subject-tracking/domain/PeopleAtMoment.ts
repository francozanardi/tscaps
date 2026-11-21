import type { SeenPerson } from '@core/subject-tracking/domain/SeenPerson';

/** The people seen in the frame shown at `sourceSec` of the source video, from left to right. */
export interface PeopleAtMoment {
  readonly sourceSec: number;
  readonly people: ReadonlyArray<SeenPerson>;
}
