import { describe, expect, it } from 'vitest';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';

/**
 * A layer's role follows from its file's type, and a file the catalog
 * does not hold has none: it is neither the shot's b-roll nor a picture,
 * and is offered on its own so the reader can see it and take it off.
 */

const reader = new ShotLayerAssetReader();

function asset(id: string, type: MediaAsset['type']): MediaAsset {
  return {
    id, type, owner: { kind: 'library' }, fileName: id, mimeType: '', sizeBytes: 1, widthPx: 1, heightPx: 1,
    durationSec: type === 'video' ? 1 : null,
  };
}

function layer(id: string, mediaId: string): ShotLayer {
  return { id, mediaId, inSec: 0, outSec: null, loop: false };
}

describe('ShotLayerAssetReader', () => {
  it('keeps a deleted picture over a b-roll apart from both roles', () => {
    const media = MediaAssetCatalog.of([asset('clip', 'video')]);
    const layers = [layer('broll', 'clip'), layer('picture', 'deleted')];

    expect(reader.videoLayerOf(layers, media)?.id).toBe('broll');
    expect(reader.pictureLayersOf(layers, media)).toEqual([]);
    expect(reader.missingLayersOf(layers, media).map(({ id }) => id)).toEqual(['picture']);
  });

  it('never takes a layer whose file is gone for the shot\'s b-roll', () => {
    const media = MediaAssetCatalog.of([]);

    expect(reader.videoLayerOf([layer('gone', 'deleted')], media)).toBeNull();
    expect(reader.read('deleted', media)).toBeNull();
  });

  it('gives a sound no role on a shot, and offers a layer naming one for removal', () => {
    const media = MediaAssetCatalog.of([{ ...asset('theme', 'audio'), widthPx: null, heightPx: null, durationSec: 90 }]);
    const layers = [layer('sound', 'theme')];

    expect(reader.roleOf('theme', media)).toBeNull();
    expect(reader.videoLayerOf(layers, media)).toBeNull();
    expect(reader.pictureLayersOf(layers, media)).toEqual([]);
    expect(reader.missingLayersOf(layers, media).map(({ id }) => id)).toEqual(['sound']);
  });
});
