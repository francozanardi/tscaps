import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioMixBuildContext } from '@core/audio-mix/domain/AudioMixBuildContext';
import type { AudioMixLayer, AudioMixLayerDuck, ResolvedAudioMix } from '@core/audio-mix/domain/AudioMixLayer';
import type { AudioTimeSpan } from '@core/audio-mix/domain/AudioTimeSpan';
import type { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';
import type { FootageSoundReader, ShotVideoLevel } from '@core/audio-mix/services/FootageSoundReader';
import type { SpeechSpanReader } from '@core/audio-mix/services/SpeechSpanReader';

/** Where a clip plays on the output, once its anchors and its file's length are read. */
interface ClipPlacement {
  readonly outputStartSec: number;
  readonly outputEndSec: number;
  readonly sourcePassSec: number;
}

/**
 * Resolves a mix against the edit into the layers that are heard: when
 * each clip plays on the output, from where in its file, how loud, with
 * which fades, and where it is lowered under speech. The preview and the
 * export both build from here, so they cannot disagree.
 *
 * - A clip whose start anchor is gone or cut away is silent and left out.
 * - An end anchor that is gone, or lands at or before the start, is read
 *   as no end. One that is cut away ends the clip where the cut
 *   collapses it.
 * - Without an end, a clip plays its file once from its in-point or,
 *   looping, until the output ends. With one, it is trimmed there, or
 *   looped to fill the span; a clip that does not loop still stops
 *   where its file does.
 * - Everything is kept inside the output: a clip starting before zero
 *   starts at zero, one starting after the output ends is left out, and
 *   none runs past the end.
 * - Fades that together outrun the clip are shortened in proportion.
 * - A clip lowered under speech carries the stretches of speech it
 *   overlaps, at its depth.
 *
 * Bundled sounds and media files are resolved alike: the file stays
 * named, for whoever plays it to read.
 *
 * The shots add to it: each shot layer whose file the mix hears is one
 * more layer, after the clips' (see {@link FootageSoundReader}), and the
 * video's own sound is brought to each shot's own level over that shot,
 * with a short ramp on each side.
 */
export class AudioMixLayerBuilder {
  static readonly DUCK_ATTACK_SEC = 0.2;
  static readonly DUCK_RELEASE_SEC = 0.5;
  /** The ramp into and out of a shot's own video level, short enough to read as a cut and long enough not to click. */
  static readonly SHOT_LEVEL_RAMP_SEC = 0.03;

  constructor(
    private readonly timing: AudioAnchorTiming,
    private readonly speech: SpeechSpanReader,
    private readonly footage: FootageSoundReader,
  ) {}

  build(mix: AudioMix, context: AudioMixBuildContext): ResolvedAudioMix {
    const outputEndSec = this.outputEndOf(context);
    const speechSpans = mix.clips().some((clip) => clip.ducking.enabled)
      ? this.speech.read(context.originalDocument, context.timeMap)
      : [];
    const clipLayers = mix.clips().flatMap((clip) => {
      const placement = this.placementOf(clip, context, outputEndSec);
      return placement === null ? [] : [this.layerOf(clip, placement, speechSpans)];
    });
    return {
      layers: [...clipLayers, ...this.footage.layersOf(mix, context)],
      inputGain: mix.sourceVolume,
      inputDucks: this.footage.shotVideoLevelsOf(mix, context).map((level) => this.inputDuckOf(level)),
    };
  }

  private inputDuckOf(level: ShotVideoLevel): AudioMixLayerDuck {
    return {
      ranges: level.spans,
      gain: level.volume,
      attackSec: AudioMixLayerBuilder.SHOT_LEVEL_RAMP_SEC,
      releaseSec: AudioMixLayerBuilder.SHOT_LEVEL_RAMP_SEC,
    };
  }

  private outputEndOf(context: AudioMixBuildContext): number {
    return context.videoDurationSec > 0 ? context.timeMap.toOutputTime(context.videoDurationSec) : Infinity;
  }

  private placementOf(clip: AudioClip, context: AudioMixBuildContext, outputEndSec: number): ClipPlacement | null {
    const start = this.timing.resolve(clip.start, context);
    if (start.kind !== 'at') return null;
    const outputStartSec = Math.max(0, start.outputSec);
    if (outputStartSec >= outputEndSec) return null;
    const length = context.sourceLengths.lengthOf(clip.source);
    const passSec = length === null ? null : length - clip.inSec;
    if (passSec !== null && !(passSec > 0)) return null;
    const endSec = this.endOf(clip, context, outputStartSec);
    const runEndSec = clip.loop
      ? endSec ?? outputEndSec
      : Math.min(endSec ?? Infinity, passSec === null ? Infinity : outputStartSec + passSec);
    return {
      outputStartSec,
      outputEndSec: Math.min(runEndSec, outputEndSec),
      sourcePassSec: clip.loop && passSec !== null ? passSec : Infinity,
    };
  }

  /** Where the clip's end anchor lands, or null where it has none worth reading. */
  private endOf(clip: AudioClip, context: AudioMixBuildContext, outputStartSec: number): number | null {
    if (clip.end === null) return null;
    const end = this.timing.resolve(clip.end, context);
    if (end.kind === 'gone' || !(end.outputSec > outputStartSec)) return null;
    return end.outputSec;
  }

  private layerOf(clip: AudioClip, placement: ClipPlacement, speechSpans: ReadonlyArray<AudioTimeSpan>): AudioMixLayer {
    const [fadeInSec, fadeOutSec] = this.fadesWithin(clip, placement.outputEndSec - placement.outputStartSec);
    return {
      id: clip.id,
      kind: 'clip',
      source: clip.source,
      outputStartSec: placement.outputStartSec,
      outputEndSec: placement.outputEndSec,
      sourceStartSec: clip.inSec,
      sourcePassSec: placement.sourcePassSec,
      gain: clip.volume,
      fadeInSec,
      fadeOutSec,
      duck: clip.ducking.enabled ? this.duckOf(clip, placement, speechSpans) : null,
    };
  }

  private fadesWithin(clip: AudioClip, runSec: number): [number, number] {
    const total = clip.fadeInSec + clip.fadeOutSec;
    if (!(total > runSec)) return [clip.fadeInSec, clip.fadeOutSec];
    const scale = runSec / total;
    return [clip.fadeInSec * scale, clip.fadeOutSec * scale];
  }

  private duckOf(clip: AudioClip, placement: ClipPlacement, speechSpans: ReadonlyArray<AudioTimeSpan>): AudioMixLayerDuck {
    return {
      ranges: speechSpans.filter((span) => span.endSec > placement.outputStartSec && span.startSec < placement.outputEndSec),
      gain: Math.pow(10, clip.ducking.depthDb / 20),
      attackSec: AudioMixLayerBuilder.DUCK_ATTACK_SEC,
      releaseSec: AudioMixLayerBuilder.DUCK_RELEASE_SEC,
    };
  }
}
