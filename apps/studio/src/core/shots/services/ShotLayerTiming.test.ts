import { describe, expect, it } from 'vitest';
import { RenderTimeMap } from '@tscaps/engine';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotLayerAsset } from '@core/shots/domain/ScheduledShotLayer';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';

/**
 * A layer opens with its shot and runs for the shorter of its stretch
 * and the shot, or loops over the whole shot; a picture or a GIF spans
 * the shot. It runs on output time: a cut inside the shot shortens the
 * shot, never the layer's run.
 */

const timing = new ShotLayerTiming(new ShotLayerAssetReader());
const NO_CUTS = new RenderTimeMap([]);
const STARTER_GRAPHIC = new BuiltinGraphicPresetCatalog().starter().graphic;

function layer(overrides: Partial<ShotLayer> = {}): ShotLayer {
  return { id: 'layer', mediaId: 'clip', inSec: 1, outSec: null, loop: false, ...overrides };
}

function video(durationSec: number | null): ShotLayerAsset {
  return { kind: 'video', durationSec, aspectRatio: null };
}

describe('ShotLayerTiming', () => {
  it('runs a stretch shorter than its shot for the stretch alone', () => {
    expect(timing.stretchOf(layer({ outSec: 3 }), video(10), 4, 10, NO_CUTS))
      .toEqual({ outputStartSec: 4, outputEndSec: 6, sourceStartSec: 1, sourcePassSec: 2 });
  });

  it('runs a stretch longer than its shot for the shot alone', () => {
    expect(timing.stretchOf(layer(), video(30), 4, 10, NO_CUTS))
      .toEqual({ outputStartSec: 4, outputEndSec: 10, sourceStartSec: 1, sourcePassSec: 29 });
  });

  it('loops a shorter stretch over the whole shot', () => {
    expect(timing.stretchOf(layer({ outSec: 3, loop: true }), video(10), 4, 10, NO_CUTS))
      .toEqual({ outputStartSec: 4, outputEndSec: 10, sourceStartSec: 1, sourcePassSec: 2 });
  });

  it('keeps running through a cut inside its shot, which only shortens the shot', () => {
    const cut = new RenderTimeMap([{ startSec: 5, endSec: 7 }]);

    expect(timing.stretchOf(layer(), video(30), 4, 10, cut))
      .toEqual({ outputStartSec: 4, outputEndSec: 8, sourceStartSec: 1, sourcePassSec: 29 });
  });

  it('shows nothing for a shot cut away whole', () => {
    const cut = new RenderTimeMap([{ startSec: 3, endSec: 11 }]);

    expect(timing.stretchOf(layer(), video(30), 4, 10, cut)).toBeNull();
  });

  it('spans the whole shot with a still asset, whatever stretch was picked', () => {
    expect(timing.stretchOf(layer({ outSec: 2 }), { kind: 'image', durationSec: null, aspectRatio: 1 }, 4, 10, NO_CUTS))
      .toEqual({ outputStartSec: 4, outputEndSec: 10, sourceStartSec: 0, sourcePassSec: Infinity });
  });

  it('plays a file of unknown length through to the end of its shot', () => {
    expect(timing.stretchOf(layer(), video(null), 4, 10, NO_CUTS)?.outputEndSec).toBe(10);
  });

  it('schedules every layer of every shot, bottom to top', () => {
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [
        { id: 'a', startSec: 0, layers: [layer({ id: 'under', inSec: 0 }), layer({ id: 'over', inSec: 0 })] },
        { id: 'b', startSec: 4 },
        { id: 'c', startSec: 6, layers: [layer({ id: 'last', inSec: 0 })] },
      ],
    });

    const scheduled = timing.scheduleAll(shots, MediaAssetCatalog.empty(), NO_CUTS, 10);

    expect(scheduled.map(({ layer: { id }, stretch }) => [id, stretch.outputStartSec, stretch.outputEndSec]))
      .toEqual([['under', 0, 4], ['over', 0, 4], ['last', 6, 10]]);
  });

  it('shows a layer from its own shot through the shot its run names', () => {
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [
        { id: 'a', startSec: 0, layers: [{ ...layer({ id: 'long', inSec: 0 }), throughShotId: 'b' }] },
        { id: 'b', startSec: 4, layers: [{ ...layer({ id: 'to-the-end', inSec: 0 }), throughShotId: 'c' }] },
        { id: 'c', startSec: 6 },
      ],
    });

    const scheduled = timing.scheduleAll(shots, MediaAssetCatalog.empty(), NO_CUTS, 10);

    expect(scheduled.map(({ layer: { id }, stretch }) => [id, stretch.outputStartSec, stretch.outputEndSec]))
      .toEqual([['long', 0, 6], ['to-the-end', 4, 10]]);
  });

  it('draws a shot\'s own video over every shot it runs through, which get no stretch of their own', () => {
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [
        { id: 'a', startSec: 0 },
        { id: 'b', startSec: 2, videoThroughShotId: 'c' },
        { id: 'c', startSec: 4 },
        { id: 'd', startSec: 6 },
      ],
      layerStyles: { 'shot-video-b': { kind: 'layer', animations: { camera: { presetId: 'layer-zoom-in-camera', params: {} } }, css: 'scale: 1.2;' } },
    });

    expect(timing.scheduleShotVideos(shots, NO_CUTS, 10).map((shot) => [shot.shotId, shot.outputStartSec, shot.outputEndSec]))
      .toEqual([['a', 0, 2], ['b', 2, 6], ['d', 6, 10]]);
    expect(timing.scheduleShots(shots, NO_CUTS, 10).map((shot) => shot.shotId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('gives a graphic after every file, and a later shot\'s layer after an earlier one\'s, so they are drawn above', () => {
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [
        { id: 'a', startSec: 0, layers: [layer({ id: 'first-file', inSec: 0 }), { id: 'first-graphic', graphic: STARTER_GRAPHIC, throughShotId: 'b' }] },
        { id: 'b', startSec: 4, layers: [layer({ id: 'second-file', inSec: 0 }), { id: 'second-graphic', graphic: STARTER_GRAPHIC }] },
      ],
    });

    const scheduled = timing.scheduleAll(shots, MediaAssetCatalog.empty(), NO_CUTS, 10);

    expect(scheduled.map(({ layer: { id } }) => id)).toEqual(['first-file', 'second-file', 'first-graphic', 'second-graphic']);
  });

  it('reads a picture and a GIF each as its own kind, spanning its shot, with its own aspect ratio', () => {
    const asset = (id: string, type: 'video' | 'image' | 'gif') => ({
      id,
      type,
      owner: { kind: 'library' as const },
      fileName: id,
      mimeType: '',
      sizeBytes: 1,
      widthPx: 400,
      heightPx: 200,
      durationSec: type === 'video' ? 1 : null,
    });
    const media = MediaAssetCatalog.of([asset('clip', 'video'), asset('logo', 'image'), asset('wave', 'gif')]);
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [{
        id: 'a',
        startSec: 0,
        layers: [
          layer({ id: 'video', mediaId: 'clip', inSec: 0 }),
          layer({ id: 'picture', mediaId: 'logo', inSec: 0 }),
          layer({ id: 'gif', mediaId: 'wave', inSec: 0 }),
        ],
      }],
    });

    const scheduled = timing.scheduleAll(shots, media, NO_CUTS, 4);

    expect(scheduled.map(({ layer: { id }, asset, stretch }) => [id, asset?.kind, asset?.aspectRatio, stretch.outputEndSec]))
      .toEqual([['video', 'video', 2, 1], ['picture', 'image', 2, 4], ['gif', 'gif', 2, 4]]);
  });

  it('reads a file the catalog does not hold as of no known type, spanning its shot', () => {
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [{ id: 'a', startSec: 0, layers: [layer({ id: 'gone', mediaId: 'deleted', inSec: 0, outSec: 1 })] }],
    });

    const scheduled = timing.scheduleAll(shots, MediaAssetCatalog.of([]), NO_CUTS, 4);

    expect(scheduled.map(({ asset, stretch }) => [asset, stretch.outputEndSec])).toEqual([[null, 4]]);
  });
});
