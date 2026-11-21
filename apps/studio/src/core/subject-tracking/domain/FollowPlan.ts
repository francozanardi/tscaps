/** Where the crop is centred at `sourceSec` of the source video, each axis a share of the picture. */
export interface CameraPathPoint {
  readonly sourceSec: number;
  readonly x: number;
  readonly y: number;
}

/**
 * How a crop follows a person through a stretch. `held`: the person
 * stays in the middle of the framing the plan was given, which is kept
 * as it is. `still`: the person stays inside one framing, so `points`
 * holds that one framing at the stretch's start. `moving`: the crop
 * moves, with a point every step from the stretch's start to its end,
 * to be joined in straight lines.
 */
export interface FollowPlan {
  readonly kind: 'held' | 'still' | 'moving';
  readonly points: ReadonlyArray<CameraPathPoint>;
}
