import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { SetShotLayerSplitTransitionAction } from '@core/shots/actions/SetShotLayerSplitTransitionAction';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';

/**
 * How a split frame divides as layers come in and joins back as they
 * leave, recorded as each layer's fields and written into its CSS.
 */

const transitions = new ShotLayerSplitTransitions();

function setUp() {
  const store = new EditorStore();
  const layer = (id: string) => ({ id, mediaId: 'clip', inSec: 0, outSec: null, loop: false });
  store.patch({
    shots: ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [{ id: 'a', startSec: 0, layers: [layer('one'), layer('two')] }] }),
  });
  const layouts = new TestShotLayerLayouts();
  const action = new SetShotLayerSplitTransitionAction(store, layouts.catalog, layouts.controls, transitions);
  const styleOf = (layerId: string) => store.snapshot().shots.layerStyles.get(layerId);
  return { store, action, styleOf };
}

describe('SetShotLayerSplitTransitionAction', () => {
  it('gives every layer the kind picked, written as its declaration', () => {
    const { action, styleOf } = setUp();

    action.setKind(['one', 'two'], 'entrance', 'reveal');

    for (const layerId of ['one', 'two']) {
      expect(transitions.kindOf(styleOf(layerId)?.fields, 'entrance')).toBe('reveal');
      expect(styleOf(layerId)?.css).toContain('--layer-split-entrance: 2');
    }
    expect(transitions.kindOf(styleOf('one')?.fields, 'exit')).toBe('slide');
  });

  it('keeps a duration within what the field allows', () => {
    const { action, styleOf } = setUp();

    action.setDurationSec(['one'], 'exit', 9);

    expect(styleOf('one')?.fields?.[ElementFieldId.SPLIT_EXIT_DURATION]).toBe(2);
    expect(styleOf('one')?.css).toContain('--layer-split-exit-duration: 2s');
  });

  it('takes a dragged duration back in one undo step', () => {
    const { store, action, styleOf } = setUp();

    action.setDurationSec(['one'], 'entrance', 0.6);
    action.setDurationSec(['one'], 'entrance', 0.8);
    store.undo();

    expect(transitions.durationSecOf(styleOf('one')?.fields, 'entrance')).toBe(0.5);
  });

  it('takes no step for a layer already saying the same, nor for one no shot holds', () => {
    const { store, action } = setUp();
    action.setKind(['one'], 'entrance', 'cut');
    const before = store.snapshot().shots;

    action.setKind(['one', 'gone'], 'entrance', 'cut');

    expect(store.snapshot().shots).toBe(before);
  });
});
