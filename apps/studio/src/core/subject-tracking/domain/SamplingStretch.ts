import type { SourceStretch } from '@core/subject-tracking/domain/SourceStretch';

/** A stretch of the source video and how many of its frames a second are looked at. */
export interface SamplingStretch extends SourceStretch {
  readonly framesPerSecond: number;
}
