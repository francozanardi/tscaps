/**
 * One framing of a camera that follows a person, at `percent` of the way
 * through its box's stretch: the share of what the crop leaves out on
 * each axis, as a position field holds it (0 the left or top edge, 1 the
 * right or bottom), or null on an axis the crop has no room to move along.
 */
export interface FollowFraming {
  readonly percent: number;
  readonly x: number | null;
  readonly y: number | null;
}

/** How the box `layerId`, showing a shot's own video, follows a person: its framings from its start to its end. */
export interface StagedShotFollow {
  readonly layerId: string;
  readonly framings: ReadonlyArray<FollowFraming>;
}
