import { describe, expect, it } from 'vitest';
import { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { ShotLayerPickPlaybackController } from '@presentation/shots/controllers/ShotLayerPickPlaybackController';

/**
 * Picking a shot layer pauses the video once, so its panel does not
 * close under the user, and leaves play alone afterwards for as long as
 * the same layer stays picked.
 */

function setUp() {
  const selection = new OverlaySelectionController();
  let pauses = 0;
  const controller = new ShotLayerPickPlaybackController(selection, () => { pauses += 1; });
  controller.start();
  return { selection, pauses: () => pauses };
}

describe('ShotLayerPickPlaybackController', () => {
  it('pauses when a layer is picked, and once only while it stays picked', () => {
    const { selection, pauses } = setUp();

    selection.pickShotLayer('layer');
    selection.setPaintedShotLayerIds(new Set(['layer']));
    selection.selectShotLayer('layer');

    expect(pauses()).toBe(1);
  });

  it('pauses again for another layer, or for the same one picked anew', () => {
    const { selection, pauses } = setUp();

    selection.selectShotLayer('first');
    selection.selectShotLayer('second');
    selection.clearSelection();
    selection.selectShotLayer('second');

    expect(pauses()).toBe(3);
  });

  it('leaves the video playing when a caption is picked', () => {
    const { selection, pauses } = setUp();

    selection.setSelection({ kind: 'caption', segmentId: 'scene', wordId: null });

    expect(pauses()).toBe(0);
  });
});
