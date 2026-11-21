import { describe, expect, it } from 'vitest';
import { ShotPartition, type ShotsSnapshot } from '@core/shots/domain/ShotPartition';
import { SHOT_TRANSITION_RECOMMENDED_DURATION_SEC } from '@core/shots/domain/ShotTransition';

/**
 * A transition belongs to the cut a shot opens with: it is stored and
 * read back with the shot, checked as it is read, never held by the
 * first shot, and goes when its cut does.
 */

const SNAPSHOT: ShotsSnapshot = {
  maxShotSec: 4,
  shots: [{ id: 'a', startSec: 0 }, { id: 'b', startSec: 2 }, { id: 'c', startSec: 4 }],
};

describe('a transition into a shot', () => {
  it('is stored with its shot and read back as it was', () => {
    const shots = ShotPartition.fromSnapshot(SNAPSHOT).withTransition('b', { kind: 'whip', durationSec: 0.8 });

    const read = ShotPartition.fromSnapshot(shots.toSnapshot());

    expect(read.list().map((shot) => shot.transition)).toEqual([undefined, { kind: 'whip', durationSec: 0.8 }, undefined]);
  });

  it('is read with its length clamped, and dropped where it names no kind there is', () => {
    const read = ShotPartition.fromSnapshot({
      ...SNAPSHOT,
      shots: [
        { id: 'a', startSec: 0 },
        { id: 'b', startSec: 2, transition: { kind: 'blur', durationSec: 9 } },
        { id: 'c', startSec: 4, transition: { kind: 'zoom', durationSec: 0.5 } as never },
      ],
    });

    expect(read.list().map((shot) => shot.transition)).toEqual([undefined, { kind: 'blur', durationSec: 1.5 }, undefined]);
  });

  it('is read at its kind\'s recommended length where its own cannot be read', () => {
    const read = ShotPartition.fromSnapshot({
      ...SNAPSHOT,
      shots: [
        { id: 'a', startSec: 0 },
        { id: 'b', startSec: 2, transition: { kind: 'iris', durationSec: 'long' } as never },
        { id: 'c', startSec: 4, transition: { kind: 'flash' } as never },
      ],
    });

    expect(read.list().map((shot) => shot.transition?.durationSec)).toEqual([
      undefined,
      SHOT_TRANSITION_RECOMMENDED_DURATION_SEC.iris,
      SHOT_TRANSITION_RECOMMENDED_DURATION_SEC.flash,
    ]);
  });

  it('is never held by the first shot, which has no cut before it', () => {
    const stored = ShotPartition.fromSnapshot({ ...SNAPSHOT, shots: [{ id: 'a', startSec: 0, transition: { kind: 'flash', durationSec: 0.5 } }] });
    const shots = ShotPartition.fromSnapshot(SNAPSHOT);

    expect(stored.list()[0]!.transition).toBeUndefined();
    expect(shots.withTransition('a', { kind: 'flash', durationSec: 0.5 })).toBe(shots);
  });

  it('goes with its cut when its shot is joined into the one before', () => {
    const shots = ShotPartition.fromSnapshot(SNAPSHOT).withTransition('b', { kind: 'flash', durationSec: 0.5 });

    expect(shots.joinIntoPrevious('b').list().map((shot) => shot.transition)).toEqual([undefined, undefined]);
  });

  it('is taken off by a plain cut, and setting the same one again changes nothing', () => {
    const shots = ShotPartition.fromSnapshot(SNAPSHOT).withTransition('b', { kind: 'flash', durationSec: 0.5 });

    expect(shots.withTransition('b', { kind: 'flash', durationSec: 0.5 })).toBe(shots);
    expect(shots.withTransition('b', null).list()[1]).toEqual({ id: 'b', startSec: 2, layers: [] });
  });
});
