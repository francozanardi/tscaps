import { describe, expect, it } from 'vitest';
import { RenderTimeMap } from '@tscaps/engine';
import { ShotOutputLengths } from '@presentation/shots/services/ShotOutputLengths';

/** How long shots and runs of them last, as the Duration list and the whole video's row say it. */

const shots = [
  { startSec: 0, endSec: 3 },
  { startSec: 3, endSec: 5 },
  { startSec: 5, endSec: 9 },
];

describe('the length of shots in the output', () => {
  it('adds up the shots of a run, both ends included', () => {
    const lengths = ShotOutputLengths.of(shots, new RenderTimeMap([]));
    expect(lengths.list()).toEqual([3, 2, 4]);
    expect(lengths.runSec(1, 1)).toBe(2);
    expect(lengths.runSec(1, 2)).toBe(6);
    expect(lengths.totalSec()).toBe(9);
  });

  it('leaves out what is cut, and a shot cut away whole lasts nothing', () => {
    const lengths = ShotOutputLengths.of(shots, new RenderTimeMap([{ startSec: 1, endSec: 2 }, { startSec: 3, endSec: 5 }]));
    expect(lengths.list()).toEqual([2, 0, 4]);
    expect(lengths.runSec(0, 2)).toBe(6);
  });
});
