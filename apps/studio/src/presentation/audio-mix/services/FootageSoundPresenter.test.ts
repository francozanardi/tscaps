import { describe, expect, it } from 'vitest';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { FootageSoundPresenter } from '@presentation/audio-mix/services/FootageSoundPresenter';

/**
 * A b-roll's own sound and a shot's video sound as their switches read
 * them, for one layer or shot and for several edited together.
 */

const presenter = new FootageSoundPresenter(new ShotLayerAssetReader());

function asset(id: string, type: MediaAsset['type']): MediaAsset {
  return {
    id, type, owner: { kind: 'project', projectId: 'project' }, fileName: id, mimeType: `${type}/x`,
    sizeBytes: 1, widthPx: 1, heightPx: 1, durationSec: type === 'video' ? 2 : null,
  };
}

const MEDIA = MediaAssetCatalog.of([asset('clip', 'video'), asset('logo', 'image')]);
const SHOTS = ShotPartition.fromSnapshot({
  maxShotSec: 4,
  shots: [
    { id: 'first', startSec: 0, layers: [{ id: 'a', mediaId: 'clip', inSec: 0, outSec: null, loop: false }] },
    { id: 'second', startSec: 2, layers: [
      { id: 'b', mediaId: 'clip', inSec: 0, outSec: null, loop: false },
      { id: 'picture', mediaId: 'logo', inSec: 0, outSec: null, loop: false },
    ] },
  ],
});

describe('a b-roll\'s own sound', () => {
  it('is offered only on layers showing a video', () => {
    expect(presenter.videoLayerIdsOf(['a', 'picture', 'b', 'gone'], SHOTS, MEDIA)).toEqual(['a', 'b']);
  });

  it('reads silent, at 0, where nothing is heard', () => {
    expect(presenter.footageSound(AudioMix.empty(), ['a'])).toEqual({ volumePercent: 0, isVolumeMixed: false, isHeard: false });
  });

  it('marks a group whose layers differ, showing the first one\'s level', () => {
    const mix = AudioMix.empty().withFootageSound(['b'], 0.4);

    expect(presenter.footageSound(mix, ['a', 'b'])).toEqual({ volumePercent: 0, isVolumeMixed: true, isHeard: true });
    expect(presenter.footageSound(mix.withFootageSound(['a'], 0.4), ['a', 'b'])).toEqual({ volumePercent: 40, isVolumeMixed: false, isHeard: true });
  });
});

describe('a shot\'s video sound', () => {
  it('reads the level of a shot the partition holds, and full for one it does not', () => {
    const mix = AudioMix.empty().withShotVideoVolume(['second', 't0.000'], 0);

    expect(presenter.shotVideoVolume(mix, ['second'], SHOTS)).toEqual({ volumePercent: 0, isVolumeMixed: false, isMuted: true, isMutedMixed: false });
    expect(presenter.shotVideoVolume(mix, ['t0.000'], SHOTS)).toMatchObject({ volumePercent: 100, isMuted: false });
    expect(presenter.shotVideoVolume(mix, ['first', 'second'], SHOTS)).toEqual({
      volumePercent: 100, isVolumeMixed: true, isMuted: false, isMutedMixed: true,
    });
  });

  it('is the one of each shot holding the layers, once', () => {
    expect(presenter.shotIdsHolding(['b', 'a', 'picture'], SHOTS)).toEqual(['second', 'first']);
  });
});
