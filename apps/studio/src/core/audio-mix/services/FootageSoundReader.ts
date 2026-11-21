import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioMixLayer } from '@core/audio-mix/domain/AudioMixLayer';
import type { AudioTimeSpan } from '@core/audio-mix/domain/AudioTimeSpan';
import type { AudioTimingContext } from '@core/audio-mix/domain/AudioTimingContext';
import type { ScheduledShotLayer } from '@core/shots/domain/ScheduledShotLayer';
import type { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';

/** Stretches of the output over which the video's own sound plays at one level other than 1. */
export interface ShotVideoLevel {
  /** Linear, 0 silent to 2. */
  readonly volume: number;
  readonly spans: ReadonlyArray<AudioTimeSpan>;
}

/**
 * Reads what the shots do to the soundtrack: the file's own sound of
 * every layer the mix hears, as a layer playing exactly while the layer
 * shows and the part of the file it shows, and the stretches of the
 * output over which the video's own sound plays at another level, a
 * shot's own.
 *
 * Only a video has a sound to hear: a layer showing a picture, a GIF or
 * a file the catalog does not hold stays silent whatever the mix says,
 * and so does a layer or a shot cut away. A heard layer fades in and
 * out over a few milliseconds, so its edges do not click.
 */
export class FootageSoundReader {
  static readonly EDGE_FADE_SEC = 0.02;

  constructor(private readonly layerTiming: ShotLayerTiming) {}

  /** A layer for each shot layer whose file is heard, in shot order and, inside a shot, bottom to top. */
  layersOf(mix: AudioMix, context: AudioTimingContext): AudioMixLayer[] {
    if (mix.footageSounds().length === 0) return [];
    return this.layerTiming
      .scheduleAll(context.shots, context.media, context.timeMap, this.videoDurationOf(context))
      .flatMap((scheduled) => {
        const volume = mix.footageVolumeOf(scheduled.layer.id);
        const { layer } = scheduled;
        if (volume === 0 || scheduled.asset?.kind !== 'video' || !('mediaId' in layer)) return [];
        return [this.layerOf(scheduled, layer.mediaId, volume)];
      });
  }

  /**
   * Where on the output the video's own sound plays at another level
   * than 1: the stretch each such shot shows over, grouped by level, in
   * shot order.
   */
  shotVideoLevelsOf(mix: AudioMix, context: AudioTimingContext): ShotVideoLevel[] {
    if (!mix.hasShotVideoVolumes()) return [];
    const levels = new Map<number, AudioTimeSpan[]>();
    for (const shot of this.layerTiming.scheduleShots(context.shots, context.timeMap, this.videoDurationOf(context))) {
      const volume = mix.shotVideoVolumeOf(shot.shotId);
      if (volume === 1) continue;
      levels.set(volume, [...(levels.get(volume) ?? []), { startSec: shot.outputStartSec, endSec: shot.outputEndSec }]);
    }
    return [...levels].map(([volume, spans]) => ({ volume, spans }));
  }

  private layerOf({ layer, stretch }: ScheduledShotLayer, mediaId: string, volume: number): AudioMixLayer {
    return {
      // Clip ids are minted UUIDs, so a prefixed layer id never meets one.
      id: `footage:${layer.id}`,
      kind: 'footage',
      source: { kind: 'media', mediaId },
      outputStartSec: stretch.outputStartSec,
      outputEndSec: stretch.outputEndSec,
      sourceStartSec: stretch.sourceStartSec,
      sourcePassSec: stretch.sourcePassSec,
      gain: volume,
      fadeInSec: FootageSoundReader.EDGE_FADE_SEC,
      fadeOutSec: FootageSoundReader.EDGE_FADE_SEC,
      duck: null,
    };
  }

  private videoDurationOf(context: AudioTimingContext): number | null {
    return context.videoDurationSec > 0 ? context.videoDurationSec : null;
  }
}
