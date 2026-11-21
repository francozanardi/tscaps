import { describe, expect, it } from 'vitest';
import { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { TimelineEditingController } from '@presentation/timeline/controllers/TimelineEditingController';
import { TimelineLayerPickExclusionController } from '@presentation/timeline/controllers/TimelineLayerPickExclusionController';

/**
 * Delete removes a picked shot layer and cuts what the timeline holds,
 * so the two are never in hand at once: whichever was taken last is the
 * one a press acts on.
 */

function harness() {
  const overlay = new OverlaySelectionController();
  const timeline = new TimelineEditingController();
  new TimelineLayerPickExclusionController(overlay, timeline).start();
  return { overlay, timeline };
}

describe('TimelineLayerPickExclusionController', () => {
  it('lets go of a held stretch when a layer is picked', () => {
    const { overlay, timeline } = harness();
    timeline.selectRange(1, 2);

    overlay.pickShotLayer('layer');

    expect(timeline.selection).toBeNull();
    expect(overlay.selectionSnapshot()).toEqual({ kind: 'shot-layer', layerId: 'layer' });
  });

  it('lets go of a held scene when a layer is picked', () => {
    const { overlay, timeline } = harness();
    timeline.selectScene('scene');

    overlay.selectShotLayer('layer');

    expect(timeline.selectedSceneId).toBeNull();
  });

  it('drops a picked layer when the timeline takes hold of a stretch or a scene', () => {
    const { overlay, timeline } = harness();
    overlay.pickShotLayer('layer');
    timeline.selectRange(1, 2);
    expect(overlay.selectionSnapshot()).toBeNull();

    overlay.pickShotLayer('layer');
    timeline.selectScene('scene');
    expect(overlay.selectionSnapshot()).toBeNull();
    expect(timeline.selectedSceneId).toBe('scene');
  });

  it('leaves a picked caption alone', () => {
    const { overlay, timeline } = harness();
    overlay.setSelection({ kind: 'caption', segmentId: 'segment', wordId: null });

    timeline.selectRange(1, 2);

    expect(overlay.selectionSnapshot()).toEqual({ kind: 'caption', segmentId: 'segment', wordId: null });
    expect(timeline.selection).not.toBeNull();
  });
});
