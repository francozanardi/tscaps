import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { NormalizedBbox } from '@core/person-segmentation/domain/NormalizedBbox';
import type { CropSize } from '@core/subject-tracking/domain/CropSize';
import type { CameraPathPoint, FollowPlan } from '@core/subject-tracking/domain/FollowPlan';
import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';
import type { PicturePosition } from '@core/subject-tracking/domain/PicturePosition';
import type { SightedFrame } from '@core/subject-tracking/domain/SightedFrame';
import { CameraPathPlanner } from '@core/subject-tracking/services/CameraPathPlanner';
import { HeadFraming } from '@core/subject-tracking/services/HeadFraming';
import { PersonFollowPlanner } from '@core/subject-tracking/services/PersonFollowPlanner';
import { PersonSightingBuilder } from '@core/subject-tracking/services/PersonSightingBuilder';
import { PersonTrackFollower } from '@core/subject-tracking/services/PersonTrackFollower';

/**
 * The real cases read what MediaPipe found, four frames a second, in
 * two takes of Tears of Steel (see the fixtures' `source`): a man
 * walking while the camera pans with him, and two people talking on a
 * bridge. The crop is a 9:16 frame cut from that 2.39:1 picture, which
 * shows under a quarter of its width.
 */

interface DetectionFixture {
  readonly frames: ReadonlyArray<{
    readonly sec: number;
    readonly poses: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>>;
    readonly faces: ReadonlyArray<readonly [number, number, number, number]>;
  }>;
}

const VERTICAL_CROP: CropSize = { width: (480 * 9) / 16 / 1152, height: 1 };
const TOP_SPEED_IN_CROP_SIDES = 1.5;
const builder = new PersonSightingBuilder();
const planner = new PersonFollowPlanner(new PersonTrackFollower(), new CameraPathPlanner(new HeadFraming()));

/** The fixture's frames as sightings, faces counted only where no pose shows a person, as the detector reports them. */
function framesOf(name: string): SightedFrame[] {
  const fixture = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../_shared/fixtures', name), 'utf8')) as DetectionFixture;
  return fixture.frames.map((frame) => {
    const fromPoses = frame.poses
      .map((pose) => builder.fromPose(pose.map(([x, y, visibility]) => ({ x, y, visibility }))))
      .filter((person): person is PersonSighting => person !== null);
    const people = fromPoses.length > 0
      ? fromPoses
      : frame.faces.map(([minX, minY, maxX, maxY]) => builder.fromFace({ minX, minY, maxX, maxY }));
    return { sourceSec: frame.sec, people };
  });
}

function stretchOf(frames: ReadonlyArray<SightedFrame>): { startSec: number; endSec: number } {
  return { startSec: frames[0]!.sourceSec, endSec: frames[frames.length - 1]!.sourceSec };
}

/** Where the crop is centred at `sec`, on the straight line between the plan's points either side of it. */
function centreAt(plan: FollowPlan, sec: number): PicturePosition {
  const points = plan.points;
  const after = points.findIndex((point) => point.sourceSec >= sec);
  if (after <= 0) return after === 0 ? points[0]! : points[points.length - 1]!;
  const [previous, next] = [points[after - 1]!, points[after]!];
  const share = (sec - previous.sourceSec) / (next.sourceSec - previous.sourceSec);
  return { x: previous.x + (next.x - previous.x) * share, y: previous.y + (next.y - previous.y) * share };
}

function isInsideCrop(head: PicturePosition, centre: PicturePosition, crop: CropSize): boolean {
  return Math.abs(head.x - centre.x) < crop.width / 2 && Math.abs(head.y - centre.y) <= crop.height / 2;
}

/** A frame in which one person's head is at `head`, their body a box below it. */
function frameWithPersonAt(sourceSec: number, head: PicturePosition): SightedFrame {
  const box: NormalizedBbox = { minX: head.x - 0.05, minY: head.y - 0.05, maxX: head.x + 0.05, maxY: Math.min(1, head.y + 0.5) };
  return { sourceSec, people: [{ box, head, source: 'pose', headHeight: 0.1 }] };
}

function framesEvery(stepSec: number, untilSec: number, headAt: (sec: number) => PicturePosition | null): SightedFrame[] {
  const frames: SightedFrame[] = [];
  for (let sec = 0; sec <= untilSec + 1e-9; sec += stepSec) {
    const head = headAt(sec);
    frames.push(head === null ? { sourceSec: sec, people: [] } : frameWithPersonAt(sec, head));
  }
  return frames;
}

function fastestMove(points: ReadonlyArray<CameraPathPoint>): number {
  let fastest = 0;
  for (let index = 1; index < points.length; index++) {
    const [previous, point] = [points[index - 1]!, points[index]!];
    fastest = Math.max(fastest, Math.abs(point.x - previous.x) / (point.sourceSec - previous.sourceSec));
  }
  return fastest;
}

describe('PersonFollowPlanner', () => {
  describe('on a man walking while the camera pans with him', () => {
    const frames = framesOf('tears-of-steel-walk.detections.json');
    const picked = frames.find((frame) => frame.sourceSec === 20)!.people[0]!;
    const plan = planner.plan(frames, { sourceSec: 20, position: picked.head }, VERTICAL_CROP, stretchOf(frames), null)!.plan;

    it('moves the crop, since no one framing holds him', () => {
      expect(plan.kind).toBe('moving');
    });

    it('keeps his head inside the crop in every frame he is seen', () => {
      const seen = frames.filter((frame) => frame.people.length === 1 && frame.people[0]!.source === 'pose');
      const outside = seen.filter((frame) => !isInsideCrop(frame.people[0]!.head, centreAt(plan, frame.sourceSec), VERTICAL_CROP));
      expect(seen.length).toBeGreaterThan(90);
      expect(outside.map((frame) => frame.sourceSec)).toEqual([]);
    });

    it('never moves the crop faster than its top speed', () => {
      expect(fastestMove(plan.points)).toBeLessThanOrEqual(VERTICAL_CROP.width * TOP_SPEED_IN_CROP_SIDES + 1e-9);
    });
  });

  describe('on two people talking on a bridge, who swap places in the detector\'s list', () => {
    const frames = framesOf('tears-of-steel-bridge.detections.json');
    const both = frames.filter((frame) => frame.people.length === 2);
    const byX = (frame: SightedFrame): PersonSighting[] => [...frame.people].sort((first, second) => first.head.x - second.head.x);

    it('keeps the woman on the right in the crop when she is the one picked', () => {
      const woman = byX(frames.find((frame) => frame.sourceSec === 9)!)[1]!;
      const plan = planner.plan(frames, { sourceSec: 9, position: woman.head }, VERTICAL_CROP, stretchOf(frames), null)!.plan;
      const lost = both.filter((frame) => !isInsideCrop(byX(frame)[1]!.head, centreAt(plan, frame.sourceSec), VERTICAL_CROP));
      expect(lost.map((frame) => frame.sourceSec)).toEqual([]);
    });

    it('keeps the man on the left in the crop when he is the one picked', () => {
      const man = byX(frames.find((frame) => frame.sourceSec === 9)!)[0]!;
      const plan = planner.plan(frames, { sourceSec: 9, position: man.head }, VERTICAL_CROP, stretchOf(frames), null)!.plan;
      const lost = both.filter((frame) => !isInsideCrop(byX(frame)[0]!.head, centreAt(plan, frame.sourceSec), VERTICAL_CROP));
      expect(lost.map((frame) => frame.sourceSec)).toEqual([]);
    });
  });

  it('holds one still framing on a person who stays inside it', () => {
    const frames = framesEvery(0.25, 6, (sec) => ({ x: 0.5 + 0.02 * Math.sin(sec * 3), y: 0.3 }));
    const plan = planner.plan(frames, { sourceSec: 3, position: { x: 0.5, y: 0.3 } }, VERTICAL_CROP, { startSec: 0, endSec: 6 }, null)!.plan;
    expect(plan.kind).toBe('still');
    expect(plan.points).toHaveLength(1);
    expect(plan.points[0]!.x).toBeCloseTo(0.5, 2);
  });

  it('keeps the framing it is given while the person stays in its middle', () => {
    const frames = framesEvery(0.25, 6, (sec) => ({ x: 0.53 + 0.01 * Math.sin(sec * 3), y: 0.3 }));
    const held = { x: 0.52, y: 0.5 };
    const plan = planner.plan(frames, { sourceSec: 3, position: { x: 0.53, y: 0.3 } }, VERTICAL_CROP, { startSec: 0, endSec: 6 }, held)!.plan;
    expect(plan).toEqual({ kind: 'held', points: [{ sourceSec: 0, x: 0.52, y: 0.5 }] });
  });

  it('keeps the framing it is given where a framing centred on the person would barely differ from it', () => {
    const quarterOfCrop = VERTICAL_CROP.width / 4;
    const tinyOffset = VERTICAL_CROP.width * 0.03;
    const frames = framesEvery(0.25, 6, (sec) => ({ x: 0.5 + tinyOffset + (sec < 3 ? -quarterOfCrop : quarterOfCrop), y: 0.3 }));
    const plan = planner.plan(frames, { sourceSec: 3, position: { x: 0.5 + tinyOffset + quarterOfCrop, y: 0.3 } }, VERTICAL_CROP, { startSec: 0, endSec: 6 }, { x: 0.5, y: 0.5 })!.plan;
    expect(plan).toEqual({ kind: 'held', points: [{ sourceSec: 0, x: 0.5, y: 0.5 }] });
  });

  it('centres a still framing on a person who stays near the edge of the framing it is given', () => {
    const quarterOfCrop = VERTICAL_CROP.width / 4;
    const frames = framesEvery(0.25, 6, () => ({ x: 0.5 + quarterOfCrop, y: 0.3 }));
    const plan = planner.plan(frames, { sourceSec: 3, position: { x: 0.5 + quarterOfCrop, y: 0.3 } }, VERTICAL_CROP, { startSec: 0, endSec: 6 }, { x: 0.5, y: 0.5 })!.plan;
    expect(plan.kind).toBe('still');
    expect(plan.points[0]!.x).toBeCloseTo(0.5 + quarterOfCrop, 3);
  });

  it('moves away from the framing it is given when the person leaves it', () => {
    const frames = framesEvery(0.25, 6, (sec) => ({ x: 0.3 + 0.07 * sec, y: 0.3 }));
    const plan = planner.plan(frames, { sourceSec: 0, position: { x: 0.3, y: 0.3 } }, VERTICAL_CROP, { startSec: 0, endSec: 6 }, { x: 0.3, y: 0.5 })!.plan;
    expect(plan.kind).toBe('moving');
    expect(centreAt(plan, 6).x).toBeGreaterThan(0.6);
  });

  it('holds where the person was last seen once they are lost', () => {
    const frames = framesEvery(0.25, 8, (sec) => (sec <= 3 ? { x: 0.2 + 0.1 * sec, y: 0.3 } : null));
    const plan = planner.plan(frames, { sourceSec: 1, position: { x: 0.3, y: 0.3 } }, VERTICAL_CROP, { startSec: 0, endSec: 8 }, null)!.plan;
    const late = plan.points.filter((point) => point.sourceSec >= 5).map((point) => point.x);
    expect(Math.max(...late) - Math.min(...late)).toBeLessThan(1e-3);
    expect(late[0]!).toBeCloseTo(0.5, 1);
  });

  it('keeps the crop inside the picture when the person nears its edge', () => {
    const frames = framesEvery(0.25, 6, (sec) => ({ x: 0.5 + 0.08 * sec, y: 0.3 }));
    const plan = planner.plan(frames, { sourceSec: 0, position: { x: 0.5, y: 0.3 } }, VERTICAL_CROP, { startSec: 0, endSec: 6 }, null)!.plan;
    for (const point of plan.points) {
      expect(point.x).toBeGreaterThanOrEqual(VERTICAL_CROP.width / 2 - 1e-9);
      expect(point.x).toBeLessThanOrEqual(1 - VERTICAL_CROP.width / 2 + 1e-9);
    }
  });

  it('plans nothing where nobody is at the pick', () => {
    const frames = framesEvery(0.25, 4, () => ({ x: 0.2, y: 0.3 }));
    expect(planner.plan(frames, { sourceSec: 2, position: { x: 0.8, y: 0.3 } }, VERTICAL_CROP, { startSec: 0, endSec: 4 }, null)).toBeNull();
  });
});
