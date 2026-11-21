import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';

/**
 * How loud the file of some b-rolls is heard, read across all of them:
 * the first one's level shows, under a marker where the rest differ.
 */
export interface FootageSoundView {
  /** As the percentage a volume slider shows; 0, the default, is silent. */
  readonly volumePercent: number;
  readonly isVolumeMixed: boolean;
  /** Some of them are heard. */
  readonly isHeard: boolean;
}

/** How loud the video's own sound is in some shots, read across all of them, the first one's showing. */
export interface ShotVideoVolumeView {
  /** As the percentage a volume slider shows. */
  readonly volumePercent: number;
  readonly isVolumeMixed: boolean;
  /** The first shot plays none of the video's own sound. */
  readonly isMuted: boolean;
  /** Some shots play none of it and others some. */
  readonly isMutedMixed: boolean;
}

/**
 * What a b-roll's own sound and a shot's video sound look like where
 * they are set: in a layer's Sound tab, in a shot's.
 *
 * A shot the partition does not hold yet, one only proposed, plays the
 * video at 1 whatever the mix names: what it names would be a shot gone.
 */
export class FootageSoundPresenter {
  constructor(private readonly assets: ShotLayerAssetReader) {}

  /** The layers of `layerIds` showing a video, the only ones with a sound to hear, in their order. */
  videoLayerIdsOf(layerIds: readonly string[], shots: ShotPartition, media: MediaAssetCatalog): string[] {
    return layerIds.filter((layerId) => {
      const layer = shots.findLayer(layerId);
      return layer !== null && 'mediaId' in layer && this.assets.isVideo(layer.mediaId, media);
    });
  }

  footageSound(mix: AudioMix, layerIds: readonly string[]): FootageSoundView {
    const volumes = layerIds.map((layerId) => mix.footageVolumeOf(layerId));
    const first = volumes[0] ?? 0;
    return {
      volumePercent: this.percentOf(first),
      isVolumeMixed: volumes.some((volume) => volume !== first),
      isHeard: volumes.some((volume) => volume > 0),
    };
  }

  /** The shots holding `layerIds`, each once, in the order first named. */
  shotIdsHolding(layerIds: readonly string[], shots: ShotPartition): string[] {
    const ids = layerIds.flatMap((layerId) => {
      const shot = shots.shotHolding(layerId);
      return shot === null ? [] : [shot.id];
    });
    return [...new Set(ids)];
  }

  shotVideoVolume(mix: AudioMix, shotIds: readonly string[], shots: ShotPartition): ShotVideoVolumeView {
    const volumes = shotIds.map((shotId) => (shots.list().some((shot) => shot.id === shotId) ? mix.shotVideoVolumeOf(shotId) : 1));
    const first = volumes[0] ?? 1;
    return {
      volumePercent: this.percentOf(first),
      isVolumeMixed: volumes.some((volume) => volume !== first),
      isMuted: first === 0,
      isMutedMixed: volumes.some((volume) => (volume === 0) !== (first === 0)),
    };
  }

  /** The files `layerIds` show, each once, in the order first named. */
  mediaIdsOf(layerIds: readonly string[], shots: ShotPartition): string[] {
    return [...new Set(layerIds.flatMap((layerId) => {
      const layer = shots.findLayer(layerId);
      return layer === null || !('mediaId' in layer) ? [] : [layer.mediaId];
    }))];
  }

  /** A linear level as the percentage a volume slider shows. */
  percentOf(gain: number): number {
    return Math.round(gain * 100);
  }

  /** A volume slider's percentage as a linear level. */
  gainOf(percent: number): number {
    return percent / 100;
  }
}
