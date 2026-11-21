import { describe, expect, it } from 'vitest';
import type { PoseLandmark } from '@core/person-segmentation/domain/PoseLandmark';
import { PersonSightingBuilder } from '@core/subject-tracking/services/PersonSightingBuilder';

/** A pose of 33 landmarks, unseen but for the ones given by their index. */
function pose(seen: Readonly<Record<number, readonly [number, number]>>): PoseLandmark[] {
  return Array.from({ length: 33 }, (_, index) => {
    const point = seen[index];
    return point === undefined ? { x: 0, y: 0, visibility: 0 } : { x: point[0], y: point[1], visibility: 1 };
  });
}

describe('PersonSightingBuilder', () => {
  it('tells how tall a head is from how far the mouth is below the eyes, the same from the front and from the side', () => {
    const builder = new PersonSightingBuilder();
    const front = builder.fromPose(pose({ 0: [0.5, 0.33], 2: [0.52, 0.3], 5: [0.48, 0.3], 9: [0.51, 0.36], 10: [0.49, 0.36] }));
    const side = builder.fromPose(pose({ 0: [0.5, 0.33], 2: [0.5, 0.3], 9: [0.5, 0.36], 11: [0.45, 0.5] }));

    expect(front?.headHeight).toBeCloseTo(0.06 * 3.4, 6);
    expect(side?.headHeight).toBeCloseTo(front!.headHeight!, 6);
  });

  it('does not guess a head height where the eyes or the mouth are not seen', () => {
    const sighting = new PersonSightingBuilder().fromPose(pose({ 0: [0.5, 0.33], 7: [0.47, 0.31], 8: [0.53, 0.31], 11: [0.45, 0.5], 12: [0.55, 0.5] }));

    expect(sighting).not.toBeNull();
    expect(sighting?.headHeight).toBeNull();
  });

  it('takes a head for one and a half times the height of the box around a face', () => {
    expect(new PersonSightingBuilder().fromFace({ minX: 0.4, minY: 0.2, maxX: 0.5, maxY: 0.4 }).headHeight).toBeCloseTo(0.29, 6);
  });
});
