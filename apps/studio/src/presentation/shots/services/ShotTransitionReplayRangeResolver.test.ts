import { describe, expect, it } from 'vitest';
import { RenderTimeMap } from '@tscaps/engine';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotTransitionReplayRangeResolver } from '@presentation/shots/services/ShotTransitionReplayRangeResolver';

/** A half-second flash on the cut at 4 s of a 10 s video. */
const shots = ShotPartition.fromSnapshot({
  maxShotSec: 6,
  shots: [{ id: 'a', startSec: 0 }, { id: 'b', startSec: 4, transition: { kind: 'flash', durationSec: 0.5 } }],
});
const resolver = new ShotTransitionReplayRangeResolver();

describe('ShotTransitionReplayRangeResolver', () => {
  it('plays the transition with a moment of either shot around it', () => {
    const range = resolver.resolve('b', shots, new RenderTimeMap([]), 10)!;

    expect(range.startSec).toBeCloseTo(3.45, 9);
    expect(range.endSec).toBeCloseTo(4.55, 9);
  });

  it('starts early enough to take in a sound that starts before the transition does', () => {
    expect(resolver.resolve('b', shots, new RenderTimeMap([]), 10, 0.6)!.startSec).toBeCloseTo(3.1, 9);
  });

  it('answers nothing for a shot with no transition', () => {
    expect(resolver.resolve('a', shots, new RenderTimeMap([]), 10)).toBeNull();
  });
});
