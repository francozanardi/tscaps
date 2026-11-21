import type { CropSize } from '@core/subject-tracking/domain/CropSize';
import type { CameraPathPoint, FollowPlan } from '@core/subject-tracking/domain/FollowPlan';
import type { PicturePosition } from '@core/subject-tracking/domain/PicturePosition';
import type { SourceStretch } from '@core/subject-tracking/domain/SourceStretch';
import type { TrackedHead } from '@core/subject-tracking/domain/TrackedHead';
import type { HeadFraming } from '@core/subject-tracking/services/HeadFraming';

/** One axis of the picture, with the share of it the crop shows. */
interface Axis {
  readonly key: 'x' | 'y';
  readonly side: number;
}

// A person whose framings all lie within this share of the crop's side from one centre is held in one still framing.
const STILL_REACH = 0.3;
// A framing given to keep is kept only while the person's framings all lie within this share of the crop's side from
// it: nearer its edge, a face turned that way leaves the crop though the head's point is still inside it.
const HELD_REACH = 0.15;
// A still framing centred on the person this near the framing given to keep, in shares of the crop's side, changes
// nothing a viewer sees, so the framing given is kept instead.
const HELD_NEARNESS = 0.05;
// How often the path has a point, in seconds.
const STEP_SEC = 0.25;
// The framings are averaged over this long before the camera follows them, so a sway or a detector's wobble does not move it.
const SMOOTHING_SEC = 1;
// The camera aims at where the framing will be this far ahead, so it starts moving as the person does, not after.
const LEAD_SEC = 0.3;
// The camera does not move while the framing stays within this share of the crop's side from where it is.
const DEAD_ZONE = 0.1;
// How fast the camera closes the distance to where it aims, per second, before its limits.
const PULL_PER_SEC = 4;
// The camera's top speed, in crop sides per second, and how long it takes to reach it from rest.
const TOP_SPEED = 1.5;
const RAMP_SEC = 0.5;

/**
 * Plans how a crop follows a person through a stretch from where their
 * head was, as a camera operator would: held still where the person
 * stays inside one framing, else moving only when the framing drifts
 * out of a middle zone, eased in and out, never faster than a top
 * speed. Gaps between the heads are bridged in straight lines, and the
 * first and last are held to the stretch's ends.
 */
export class CameraPathPlanner {
  constructor(private readonly framing: HeadFraming) {}

  /**
   * How a `crop`-sized crop follows the person whose head was at
   * `heads` (in time order) through `stretch`. Where `held` is given and
   * the person stays in the middle of the framing it centres, that
   * framing is kept as it is (`held`), as it is where the still framing
   * centred on them would lie within 5% of the crop's side of it. A
   * crop that moves looks at `untilFound`, where given, until the first
   * head, and glides from it to the person; it never decides whether
   * the crop moves. Null where there is no head.
   */
  plan(
    heads: ReadonlyArray<TrackedHead>,
    crop: CropSize,
    stretch: SourceStretch,
    held: PicturePosition | null,
    untilFound: PicturePosition | null,
  ): FollowPlan | null {
    const targets = this.targetsOf(heads, crop);
    if (targets.length === 0) return null;
    const axes = this.axesOf(crop);
    const kept = held === null ? null : this.framing.inside(held, crop);
    if (held !== null && kept !== null && this.holdsAll(targets, held, axes, HELD_REACH)) return this.still('held', kept, stretch);
    const middle = this.middleOf(targets, crop);
    if (this.holdsAll(targets, middle, axes, STILL_REACH)) {
      const nearKept = kept !== null && this.holdsAll([middle], kept, axes, HELD_NEARNESS);
      return nearKept && kept !== null ? this.still('held', kept, stretch) : this.still('still', middle, stretch);
    }
    const before = untilFound === null ? null : this.framing.inside(untilFound, crop);
    return { kind: 'moving', points: this.moving(targets, before, crop, stretch, axes) };
  }

  /** Where the crop would be centred to frame each head. */
  private targetsOf(heads: ReadonlyArray<TrackedHead>, crop: CropSize): CameraPathPoint[] {
    return heads.map((head) => ({ sourceSec: head.sourceSec, ...this.framing.centreFor(head, crop) }));
  }

  /** The axes along which the crop has room to move. */
  private axesOf(crop: CropSize): Axis[] {
    const axes: Axis[] = [];
    if (crop.width < 1) axes.push({ key: 'x', side: crop.width });
    if (crop.height < 1) axes.push({ key: 'y', side: crop.height });
    return axes;
  }

  private holdsAll(targets: ReadonlyArray<PicturePosition>, centre: PicturePosition, axes: ReadonlyArray<Axis>, reach: number): boolean {
    return axes.every((axis) => targets.every((target) => Math.abs(target[axis.key] - centre[axis.key]) <= axis.side * reach));
  }

  /** The centre halfway between the furthest framings on each axis. */
  private middleOf(targets: ReadonlyArray<CameraPathPoint>, crop: CropSize): PicturePosition {
    const halfway = (values: number[]): number => (Math.min(...values) + Math.max(...values)) / 2;
    return this.framing.inside({ x: halfway(targets.map((target) => target.x)), y: halfway(targets.map((target) => target.y)) }, crop);
  }

  private still(kind: 'held' | 'still', centre: PicturePosition, stretch: SourceStretch): FollowPlan {
    return { kind, points: [{ sourceSec: stretch.startSec, x: centre.x, y: centre.y }] };
  }

  /** The camera's path, a point every step from the stretch's start to its end, at `before` until the first target where given. */
  private moving(
    targets: ReadonlyArray<CameraPathPoint>,
    before: PicturePosition | null,
    crop: CropSize,
    stretch: SourceStretch,
    axes: ReadonlyArray<Axis>,
  ): CameraPathPoint[] {
    const times = this.stepsThrough(stretch);
    const firstSec = targets[0]!.sourceSec;
    const aims = this.smoothed(times.map((sec) => (before !== null && sec + LEAD_SEC < firstSec ? before : this.targetAt(targets, sec + LEAD_SEC))));
    const followed = new Map<'x' | 'y', number[]>();
    for (const axis of axes) followed.set(axis.key, this.followAlong(aims.map((aim) => aim[axis.key]), axis.side));
    return times.map((sourceSec, index) => {
      const centre = this.framing.inside({
        x: followed.get('x')?.[index] ?? aims[index]!.x,
        y: followed.get('y')?.[index] ?? aims[index]!.y,
      }, crop);
      return { sourceSec, x: centre.x, y: centre.y };
    });
  }

  private stepsThrough(stretch: SourceStretch): number[] {
    const times: number[] = [];
    for (let sec = stretch.startSec; sec < stretch.endSec; sec += STEP_SEC) times.push(sec);
    times.push(stretch.endSec);
    return times;
  }

  /** The framing at `sec`: on a straight line between the targets either side of it, the first or last one outside them. */
  private targetAt(targets: ReadonlyArray<CameraPathPoint>, sec: number): PicturePosition {
    const after = targets.findIndex((target) => target.sourceSec >= sec);
    if (after === -1) return targets[targets.length - 1]!;
    if (after === 0) return targets[0]!;
    const next = targets[after]!;
    const previous = targets[after - 1]!;
    const share = (sec - previous.sourceSec) / (next.sourceSec - previous.sourceSec);
    return { x: previous.x + (next.x - previous.x) * share, y: previous.y + (next.y - previous.y) * share };
  }

  /** Each aim averaged with the ones within half the smoothing time of it. */
  private smoothed(aims: ReadonlyArray<PicturePosition>): PicturePosition[] {
    const reach = Math.round(SMOOTHING_SEC / STEP_SEC / 2);
    return aims.map((_, index) => {
      const window = aims.slice(Math.max(0, index - reach), index + reach + 1);
      return {
        x: window.reduce((sum, aim) => sum + aim.x, 0) / window.length,
        y: window.reduce((sum, aim) => sum + aim.y, 0) / window.length,
      };
    });
  }

  /**
   * The camera's position along one axis at each step, starting on the
   * first aim: still while the aim stays inside the dead zone, else
   * pulled towards the zone's edge, its speed and its change of speed
   * held under their limits.
   */
  private followAlong(aims: ReadonlyArray<number>, side: number): number[] {
    const deadZone = side * DEAD_ZONE;
    const topSpeed = side * TOP_SPEED;
    const topChange = (topSpeed / RAMP_SEC) * STEP_SEC;
    let position = aims[0]!;
    let speed = 0;
    return aims.map((aim, index) => {
      if (index === 0) return position;
      const offset = aim - position;
      const goal = Math.abs(offset) <= deadZone ? position : aim - Math.sign(offset) * deadZone;
      const wanted = this.limited((goal - position) * PULL_PER_SEC, topSpeed);
      speed = speed + this.limited(wanted - speed, topChange);
      position += speed * STEP_SEC;
      return position;
    });
  }

  private limited(value: number, limit: number): number {
    return Math.max(-limit, Math.min(limit, value));
  }
}
