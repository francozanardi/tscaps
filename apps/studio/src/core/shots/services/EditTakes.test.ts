import { describe, expect, it } from 'vitest';
import { EditTakes } from '@core/shots/services/EditTakes';

/**
 * A take is what a viewer sees as one picture: it ends where the video
 * changes camera by itself and where something takes the frame, and
 * nowhere else.
 */

const takes = new EditTakes();

describe('EditTakes', () => {
  it('is one take for a video of one camera with nothing over it', () => {
    expect(takes.of(60, [], [], [])).toEqual([{ startSec: 0, endSec: 60, watchedSec: 60, layerId: null }]);
  });

  it('ends a take at each change of the video\'s own picture, but not at a flash', () => {
    const found = takes.of(30, [10, 10.1, 20], [], []);

    expect(found.map((take) => [take.startSec, take.endSec])).toEqual([[0, 10], [10, 20], [20, 30]]);
  });

  it('ends a take where a layer takes the frame and where it leaves, the layer being a take of its own', () => {
    const found = takes.of(30, [], [{ layerId: 'broll', startSec: 12, endSec: 15 }], []);

    expect(found).toEqual([
      { startSec: 0, endSec: 12, watchedSec: 12, layerId: null },
      { startSec: 12, endSec: 15, watchedSec: 3, layerId: 'broll' },
      { startSec: 15, endSec: 30, watchedSec: 15, layerId: null },
    ]);
  });

  it('keeps a layer one take over a change of camera it hides', () => {
    const found = takes.of(30, [13], [{ layerId: 'broll', startSec: 12, endSec: 15 }], []);

    expect(found.map((take) => take.layerId)).toEqual([null, 'broll', null]);
  });

  it('counts a take as long as it is watched, and leaves out one the cuts remove', () => {
    const found = takes.of(30, [10, 20], [], [{ startSec: 2, endSec: 5 }, { startSec: 10, endSec: 20 }]);

    expect(found).toEqual([
      { startSec: 0, endSec: 10, watchedSec: 7, layerId: null },
      { startSec: 20, endSec: 30, watchedSec: 10, layerId: null },
    ]);
  });
});
