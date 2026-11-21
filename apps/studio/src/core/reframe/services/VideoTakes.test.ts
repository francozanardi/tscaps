import { describe, expect, it } from 'vitest';
import { VideoTakes } from '@core/reframe/services/VideoTakes';
import { EditorStore } from '@core/editor/store/EditorStore';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';

/**
 * The takes of a video: the stretches between its own picture changes,
 * a flash too short to be a take folded into the one before, and a take
 * the cuts remove whole left out.
 */

function storeWith(durationSec: number, cuts: CutRegistry = CutRegistry.empty()): EditorStore {
  const store = new EditorStore();
  store.patch({ video: { ...store.snapshot().video, duration: durationSec }, cuts });
  return store;
}

describe('VideoTakes', () => {
  it('cuts the video into takes at its picture changes', async () => {
    const takes = await new VideoTakes(storeWith(20), { read: async () => [5, 12.5] }).read();

    expect(takes).toEqual([
      { index: 0, startSec: 0, endSec: 5 },
      { index: 1, startSec: 5, endSec: 12.5 },
      { index: 2, startSec: 12.5, endSec: 20 },
    ]);
  });

  it('folds a stretch too short to be a take into the take before, and leaves out a take cut away whole', async () => {
    const cuts = CutRegistry.empty().add({ startSec: 12.5, endSec: 20 });

    const takes = await new VideoTakes(storeWith(20, cuts), { read: async () => [5, 5.1, 12.5, 19.9] }).read();

    expect(takes).toEqual([
      { index: 0, startSec: 0, endSec: 5 },
      { index: 1, startSec: 5, endSec: 12.5 },
    ]);
  });

  it('reads the picture changes the project already knows before looking for them', async () => {
    const store = storeWith(10);
    store.patchVideo({ pictureChangesSec: [4] });

    const takes = await new VideoTakes(store, { read: async () => { throw new Error('not looked for'); } }).read();

    expect(takes.map((take) => take.startSec)).toEqual([0, 4]);
  });
});
