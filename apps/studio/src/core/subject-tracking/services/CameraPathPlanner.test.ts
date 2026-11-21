import { describe, expect, it } from 'vitest';
import type { CropSize } from '@core/subject-tracking/domain/CropSize';
import type { CameraPathPoint } from '@core/subject-tracking/domain/FollowPlan';
import type { TrackedHead } from '@core/subject-tracking/domain/TrackedHead';
import { CameraPathPlanner } from '@core/subject-tracking/services/CameraPathPlanner';
import { HeadFraming } from '@core/subject-tracking/services/HeadFraming';

/**
 * Where a crop looks before the person is first found: a person the
 * detector only sees from 3 s on, in a vertical crop a third of the
 * picture wide.
 */

const CROP: CropSize = { width: 0.3, height: 1 };
const SIX_SECONDS = { startSec: 0, endSec: 6 };
const planner = new CameraPathPlanner(new HeadFraming());

/** A head every quarter second from 3 s to 6 s, across the picture as `xAt` says. */
function headsFromThreeSeconds(xAt: (sec: number) => number): TrackedHead[] {
  const heads: TrackedHead[] = [];
  for (let sec = 3; sec <= 6 + 1e-9; sec += 0.25) heads.push({ sourceSec: sec, x: xAt(sec), y: 0.3 });
  return heads;
}

function xAt(points: ReadonlyArray<CameraPathPoint>, sec: number): number {
  return points.reduce((nearest, point) => (Math.abs(point.sourceSec - sec) < Math.abs(nearest.sourceSec - sec) ? point : nearest)).x;
}

describe('CameraPathPlanner', () => {
  const walking = headsFromThreeSeconds((sec) => 0.3 + 0.1 * (sec - 3));

  it('looks where it is told until the person is first found, then reaches them', () => {
    const plan = planner.plan(walking, CROP, SIX_SECONDS, null, { x: 0.6, y: 0.5 })!;

    expect(plan.kind).toBe('moving');
    expect(xAt(plan.points, 0)).toBeCloseTo(0.6, 3);
    expect(xAt(plan.points, 2)).toBeCloseTo(0.6, 3);
    for (const head of walking) expect(Math.abs(xAt(plan.points, head.sourceSec) - head.x)).toBeLessThan(CROP.width / 2);
  });

  it('holds the first place the person was found when it is told nothing', () => {
    const plan = planner.plan(walking, CROP, SIX_SECONDS, null, null)!;

    expect(xAt(plan.points, 0)).toBeCloseTo(0.3, 3);
    expect(xAt(plan.points, 2)).toBeCloseTo(0.3, 3);
  });

  it('does not let where it looks first decide whether the crop moves', () => {
    const standing = headsFromThreeSeconds(() => 0.3);

    const plan = planner.plan(standing, CROP, SIX_SECONDS, null, { x: 0.8, y: 0.5 })!;

    expect(plan).toEqual({ kind: 'still', points: [{ sourceSec: 0, x: 0.3, y: 0.5 }] });
  });
});
