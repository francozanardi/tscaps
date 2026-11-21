import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import type { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { ShotPartition, type ShotsSnapshot } from '@core/shots/domain/ShotPartition';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { ShotLayerPreviewFootageStore } from '@core/shots/store/ShotLayerPreviewFootageStore';
import { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { ShotLayerHitTargetController } from '@presentation/shots/controllers/ShotLayerHitTargetController';
import type { ShotLayerCssOwnedGestureReader } from '@presentation/shots/services/ShotLayerCssOwnedGestureReader';
import { ShotLayerHitTargetResolver } from '@presentation/shots/services/ShotLayerHitTargetResolver';

/**
 * A shot picked to be inspected as a whole counts as painted while the
 * playhead is on its own video — its own stretch and the shots its
 * video runs through — and not elsewhere, so the inspector can say when
 * it is not on screen.
 */

function setUp(snapshot: Omit<ShotsSnapshot, 'maxShotSec'>) {
  const store = new EditorStore();
  store.patch({ projectId: 'project', shots: ShotPartition.fromSnapshot({ maxShotSec: 6, ...snapshot }) });
  store.setDuration(12);
  const selection = new OverlaySelectionController();
  // The shots hold no layers, so nothing asks a file whether it is ready or a style what it took over.
  const preparer = { subscribe: () => () => undefined } as unknown as MediaAssetPreparer;
  new ShotLayerHitTargetController(
    store,
    new ShotLayerTiming(new ShotLayerAssetReader()),
    new ShotLayerHitTargetResolver(),
    new ShotLayerPreviewFootageStore(),
    new MediaAssetStore(),
    preparer,
    selection,
    {} as ShotLayerCssOwnedGestureReader,
  ).start();
  return { store, selection };
}

describe('ShotLayerHitTargetController for a picked shot', () => {
  it('paints the shot only while the playhead is on it', () => {
    const { store, selection } = setUp({ shots: [{ id: 'a', startSec: 0 }, { id: 'b', startSec: 4 }, { id: 'c', startSec: 8 }] });
    selection.pickShot('b');

    store.setCurrentTime(5);
    expect(selection.paintedSelectionSnapshot()).toEqual({ kind: 'shot', shotId: 'b' });

    store.setCurrentTime(2);
    expect(selection.paintedSelectionSnapshot()).toBeNull();

    store.setCurrentTime(8);
    expect(selection.paintedSelectionSnapshot()).toBeNull();
  });

  it('paints the shot over the shots its video runs through', () => {
    // Only a video with a style of its own runs through later shots.
    const { store, selection } = setUp({
      shots: [{ id: 'a', startSec: 0, videoThroughShotId: 'b' }, { id: 'b', startSec: 4 }, { id: 'c', startSec: 8 }],
      layerStyles: { 'shot-video-a': { kind: 'layer', animations: { camera: { presetId: 'layer-zoom-in-camera', params: {} } }, css: 'scale: 1.2;' } },
    });
    selection.pickShot('a');

    store.setCurrentTime(6);
    expect(selection.paintedSelectionSnapshot()).toEqual({ kind: 'shot', shotId: 'a' });

    store.setCurrentTime(9);
    expect(selection.paintedSelectionSnapshot()).toBeNull();
  });
});
