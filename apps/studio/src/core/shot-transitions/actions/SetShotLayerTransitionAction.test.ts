import { describe, expect, it } from 'vitest';
import { RecordingShotTelemetry } from '@core/shots/testing/RecordingShotTelemetry';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { EditorStore } from '@core/editor/store/EditorStore';
import { SetShotLayerInsetTransitionAction } from '@core/shots/actions/SetShotLayerInsetTransitionAction';
import { SetShotLayerSplitTransitionAction } from '@core/shots/actions/SetShotLayerSplitTransitionAction';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { SetShotLayerTransitionAction } from '@core/shot-transitions/actions/SetShotLayerTransitionAction';
import { LayerTransitionSoundSuggestions } from '@core/shot-transitions/domain/LayerTransitionSoundSuggestions';

/**
 * Picking how a split's line or a box moves at one end of shot layers
 * brings the sound that kind suggests, on that transition, in the same
 * undo step: in place of the old kind's, unless that one was picked and
 * its sound taken off since; none for a cut, which takes every sound on
 * the transition with it.
 */

const SUGGESTIONS = new LayerTransitionSoundSuggestions();
const splitTransitions = new ShotLayerSplitTransitions();
const insetTransitions = new ShotLayerInsetTransitions();

function setUp() {
  const store = new EditorStore();
  const telemetry = new RecordingShotTelemetry();
  const layouts = new TestShotLayerLayouts();
  const layer = (id: string) => ({ id, mediaId: 'clip', inSec: 0, outSec: null, loop: false });
  let styles = layouts.writer.written(store.snapshot().shots.layerStyles, 'one', {
    kind: 'split', assetSide: 'start', assetRatio: 0.5, padding: 0, cornerRadius: 0, fit: 'cover',
  });
  styles = layouts.writer.written(styles, 'two', {
    kind: 'split', assetSide: 'end', assetRatio: 0.5, padding: 0, cornerRadius: 0, fit: 'cover',
  });
  store.patch({
    shots: ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [{ id: 'a', startSec: 0, layers: [layer('one'), layer('two')] }] })
      .withLayerStyles(styles),
  });
  const action = new SetShotLayerTransitionAction(
    store,
    new SetShotLayerSplitTransitionAction(store, layouts.catalog, layouts.controls, splitTransitions),
    new SetShotLayerInsetTransitionAction(store, layouts.catalog, layouts.controls, insetTransitions),
    splitTransitions,
    insetTransitions,
    SUGGESTIONS,
    new AudioClipDefaults(),
    telemetry.edits,
  );
  const soundsOn = (layerId: string, edge: 'entrance' | 'exit' = 'entrance') =>
    SUGGESTIONS.clipsOn(store.snapshot().audio, layerId, edge).map((clip) => (clip.source.kind === 'builtin' ? clip.source.soundId : ''));
  return { store, action, soundsOn, telemetry };
}

describe('SetShotLayerTransitionAction', () => {
  it('gives every layer the kind and its sound on that transition, in one undo step', () => {
    const { store, action, soundsOn } = setUp();

    action.pickSplit(['one', 'two'], 'entrance', 'reveal');

    expect(splitTransitions.kindOf(store.snapshot().shots.layerStyles.get('two')?.fields, 'entrance')).toBe('reveal');
    expect(soundsOn('one')).toEqual(['swish']);
    expect(soundsOn('two')).toEqual(['swish']);
    expect(soundsOn('one', 'exit')).toEqual([]);
    store.undo();
    expect(store.snapshot().audio.clips()).toEqual([]);
    expect(splitTransitions.kindOf(store.snapshot().shots.layerStyles.get('one')?.fields, 'entrance')).toBe('slide');
  });

  it('places the sound so its loudest part lands on the middle of the transition, under the voice', () => {
    const { store, action } = setUp();

    action.pickSplit(['one'], 'entrance', 'reveal');

    const [clip] = store.snapshot().audio.clips();
    expect(clip?.start).toEqual({ anchor: { kind: 'layer-transition', layerId: 'one', edge: 'entrance' }, offsetSec: -0.05 });
    expect(clip?.volume).toBe(0.2);
  });

  it('swaps the sound for the new kind\'s, and adds nothing when its sound was taken off', () => {
    const { store, action, soundsOn } = setUp();
    action.pickSplit(['one'], 'entrance', 'reveal');

    action.pickSplit(['one'], 'entrance', 'slide');
    expect(soundsOn('one')).toEqual(['whoosh-fast']);

    store.patch({ audio: store.snapshot().audio.withoutClips(store.snapshot().audio.clips().map((clip) => clip.id)) });
    action.pickSplit(['one'], 'entrance', 'reveal');
    expect(soundsOn('one')).toEqual([]);
  });

  it('takes every sound on the transition off on a cut, and leaves re-picking the same kind\'s sound alone', () => {
    const { action, soundsOn } = setUp();
    action.pickSplit(['one'], 'entrance', 'reveal');

    action.pickSplit(['one'], 'entrance', 'reveal');
    expect(soundsOn('one')).toEqual(['swish']);

    action.pickSplit(['one'], 'entrance', 'cut');
    expect(soundsOn('one')).toEqual([]);
  });

  it('brings a box\'s sound from the whole frame', () => {
    const { store, action, soundsOn } = setUp();
    const layouts = new TestShotLayerLayouts();
    store.patch({
      shots: store.snapshot().shots.withLayerStyles(layouts.writer.written(store.snapshot().shots.layerStyles, 'one', {
        kind: 'inset', subject: 'video', centerX: 0.5, centerY: 0.5, width: 0.4, aspectRatio: null, padding: 0.04, cornerRadius: 0.04, fit: 'cover',
      })),
    });

    action.pickInset(['one'], 'exit', 'full');

    expect(soundsOn('one', 'exit')).toEqual(['whoosh-pass']);
  });
});

describe('reporting a layer transition picked', () => {
  it('reports the kind picked for the layers, and nothing for the kind they already have', () => {
    const { action, telemetry } = setUp();

    action.pickSplit(['one', 'two'], 'entrance', 'reveal');
    action.pickSplit(['one', 'two'], 'entrance', 'reveal');

    expect(telemetry.propertiesOf('shot_layer_transition_set')).toEqual([
      { layout: 'split', edge: 'entrance', kind: 'reveal', layer_count: 2 },
    ]);
  });
});
