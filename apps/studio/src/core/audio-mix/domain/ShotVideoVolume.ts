/**
 * How loud the video's own sound is during one shot, on top of the
 * video's level: linear, 0 (silent) to 2. A shot without one plays it
 * at 1.
 */
export interface ShotVideoVolume {
  readonly shotId: string;
  readonly volume: number;
}
