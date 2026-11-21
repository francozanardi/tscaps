import { describe, expect, it } from 'vitest';
import { RecordingShotTelemetry } from '@core/shots/testing/RecordingShotTelemetry';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { EditorStore } from '@core/editor/store/EditorStore';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { SetShotLayerPlacementAction } from '@core/shots/actions/SetShotLayerPlacementAction';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { LastEditedPlacementRecorder } from '@core/shots/services/LastEditedPlacementRecorder';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { LayerTransitionSoundSuggestions } from '@core/shot-transitions/domain/LayerTransitionSoundSuggestions';
import { TransitionSoundShotLayoutFollower } from '@core/shot-transitions/services/TransitionSoundShotLayoutFollower';

/**
 * A layer laid out anew comes in with the sounds of its new layout's
 * transitions, in the same undo step, and leaves its old layout's
 * behind; a layer that keeps its layout keeps its sounds.
 */

const SUGGESTIONS = new LayerTransitionSoundSuggestions();
const SPLIT: ShotLayerPlacement = { kind: 'split', assetSide: 'start', assetRatio: 0.5, padding: 0, cornerRadius: 0, fit: 'cover' };
const FULL: ShotLayerPlacement = { kind: 'full', fit: 'cover' };

function setUp() {
  const store = new EditorStore();
  const layouts = new TestShotLayerLayouts();
  const media = new MediaAssetStore();
  store.patch({
    shots: ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [{ id: 'a', startSec: 0, layers: [{ id: 'broll', mediaId: 'clip', inSec: 0, outSec: null, loop: false }] }],
    }),
  });
  const follower = new TransitionSoundShotLayoutFollower(
    new ShotLayerSplitTransitions(),
    new ShotLayerInsetTransitions(),
    SUGGESTIONS,
    new AudioClipDefaults(),
  );
  const telemetry = new RecordingShotTelemetry();
  const action = new SetShotLayerPlacementAction(store, layouts.writer, new LastEditedPlacementRecorder(media, new ShotLayerAssetReader()), follower,
    telemetry.layoutChanges, telemetry.edits);
  const soundsOn = (edge: 'entrance' | 'exit') =>
    SUGGESTIONS.clipsOn(store.snapshot().audio, 'broll', edge).map((clip) => (clip.source.kind === 'builtin' ? clip.source.soundId : ''));
  return { store, action, soundsOn };
}

describe('TransitionSoundShotLayoutFollower', () => {
  it('gives a layer switched to a split the sound of the slide it plays at each end, in one undo step', () => {
    const { store, action, soundsOn } = setUp();

    action.execute('broll', SPLIT);

    expect(soundsOn('entrance')).toEqual(['whoosh-fast']);
    expect(soundsOn('exit')).toEqual(['whoosh-fast']);
    store.undo();
    expect(store.snapshot().audio.clips()).toEqual([]);
    expect(store.snapshot().shots.placementOf('broll').kind).toBe('full');
  });

  it('keeps the sounds of a layer that stays split, and drops them when it leaves the split', () => {
    const { action, soundsOn } = setUp();
    action.execute('broll', SPLIT);

    action.execute('broll', { ...SPLIT, assetSide: 'end' });
    expect(soundsOn('entrance')).toEqual(['whoosh-fast']);

    action.execute('broll', FULL);
    expect(soundsOn('entrance')).toEqual([]);
    expect(soundsOn('exit')).toEqual([]);
  });

  it('gives a box nothing while it stays in its box at each end', () => {
    const { store, action } = setUp();

    action.execute('broll', { kind: 'inset', centerX: 0.5, centerY: 0.5, width: 0.4, aspectRatio: 1, padding: 0, cornerRadius: 0, fit: 'cover', subject: 'asset' });

    expect(store.snapshot().shots.placementOf('broll').kind).toBe('inset');
    expect(store.snapshot().audio.clips()).toEqual([]);
  });
});
