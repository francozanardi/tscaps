import { describe, expect, it } from 'vitest';
import { ElementInspectorSelectionController } from '@presentation/editor/controllers/ElementInspectorSelectionController';
import { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { EditorWorkspaceStore } from '@presentation/editor/stores/EditorWorkspaceStore';

/**
 * The inspector opens on a direct pick and closes only once the pick is
 * let go, never because of where the playhead is: an element is judged
 * by playing through it.
 */

function setUp() {
  const selection = new OverlaySelectionController();
  const workspace = new EditorWorkspaceStore();
  new ElementInspectorSelectionController(selection, workspace).start();
  return { selection, workspace };
}

describe('ElementInspectorSelectionController', () => {
  it('keeps a shot layer open while the playhead is off it', () => {
    const { selection, workspace } = setUp();

    selection.pickShotLayer('layer');
    selection.setPaintedShotLayerIds(new Set(['layer']));
    selection.setPaintedShotLayerIds(new Set());

    expect(workspace.isInspectorOpen).toBe(true);
  });

  it('opens a shot layer picked while the playhead is off it', () => {
    const { selection, workspace } = setUp();

    selection.pickShotLayer('layer');

    expect(workspace.isInspectorOpen).toBe(true);
    expect(selection.selectionSnapshot()).toEqual({ kind: 'shot-layer', layerId: 'layer' });
  });

  it('keeps a caption open once its scene stops being painted', () => {
    const { selection, workspace } = setUp();
    selection.setPaintedSegmentIds(new Set(['scene']));
    selection.pickCaption('scene', 'word');

    selection.setPaintedSegmentIds(new Set());

    expect(workspace.isInspectorOpen).toBe(true);
    expect(selection.paintedSelectionSnapshot()).toBeNull();
  });

  it('closes once nothing is picked', () => {
    const { selection, workspace } = setUp();
    selection.pickShotLayer('layer');

    selection.clearSelection();

    expect(workspace.isInspectorOpen).toBe(false);
  });
});
