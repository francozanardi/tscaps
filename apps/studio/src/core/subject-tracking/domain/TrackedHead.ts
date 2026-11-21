/** Where a followed person's head was in the frame shown at `sourceSec` of the source video, each axis a share of the picture. */
export interface TrackedHead {
  readonly sourceSec: number;
  readonly x: number;
  readonly y: number;
}
