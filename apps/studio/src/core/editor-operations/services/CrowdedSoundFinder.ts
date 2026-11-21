import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioTimingContext } from '@core/audio-mix/domain/AudioTimingContext';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import type { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';

/** An effect that starts too close to another one, and that other one, each where it starts on the output. */
export interface CrowdedSound {
  readonly clip: AudioClip;
  readonly outputSec: number;
  readonly neighbour: AudioClip;
  readonly neighbourOutputSec: number;
}

/** An effect that plays, where it starts on the output, and its place in the mix to break ties. */
interface PlayingSound {
  readonly clip: AudioClip;
  readonly outputSec: number;
  readonly order: number;
}

/**
 * Finds the effects that start too close to another effect for the two
 * to be heard as two moments: less than {@link CrowdedSoundFinder.MIN_GAP_SEC}
 * apart on the output. Only effects that play count: one cut away, on an
 * emoji that does not show, or on something gone is not heard. A riser
 * and the sound it lands on are one moment, not two, so that pair is
 * never crowded.
 */
export class CrowdedSoundFinder {
  /** Closer than this, two effects blur into noise instead of marking two moments. */
  static readonly MIN_GAP_SEC = 2;
  // How far past a riser's end a sound still reads as its landing.
  private static readonly LANDING_SLACK_SEC = 0.25;

  constructor(
    private readonly timing: AudioAnchorTiming,
    private readonly sounds: BuiltinSoundCatalog,
  ) {}

  /**
   * For each effect of `clips` named in `addedIds` that plays, the
   * nearest other playing effect of `clips` too close to it. A pair of
   * two added effects is answered once, on the later of the two; music
   * is never counted.
   */
  find(clips: ReadonlyArray<AudioClip>, addedIds: ReadonlySet<string>, context: AudioTimingContext): CrowdedSound[] {
    const playing = this.playingEffects(clips, context);
    return playing.flatMap((sound): CrowdedSound[] => {
      if (!addedIds.has(sound.clip.id)) return [];
      const neighbour = this.nearestTooClose(sound, playing, addedIds);
      return neighbour === null ? [] : [{ clip: sound.clip, outputSec: sound.outputSec, neighbour: neighbour.clip, neighbourOutputSec: neighbour.outputSec }];
    });
  }

  private playingEffects(clips: ReadonlyArray<AudioClip>, context: AudioTimingContext): PlayingSound[] {
    return clips.flatMap((clip, order): PlayingSound[] => {
      if (clip.role !== 'effect') return [];
      const landing = this.timing.resolve(clip.start, context);
      return landing.kind === 'at' ? [{ clip, outputSec: landing.outputSec, order }] : [];
    });
  }

  private nearestTooClose(sound: PlayingSound, playing: ReadonlyArray<PlayingSound>, addedIds: ReadonlySet<string>): PlayingSound | null {
    let nearest: PlayingSound | null = null;
    for (const other of playing) {
      if (other.clip.id === sound.clip.id) continue;
      const gapSec = Math.abs(other.outputSec - sound.outputSec);
      if (gapSec >= CrowdedSoundFinder.MIN_GAP_SEC) continue;
      if (addedIds.has(other.clip.id) && this.isLater(other, sound)) continue;
      if (this.landsOn(this.earlier(sound, other), this.later(sound, other))) continue;
      if (nearest === null || gapSec < Math.abs(nearest.outputSec - sound.outputSec)) nearest = other;
    }
    return nearest;
  }

  /** Whether `first` is a bundled riser still building, or just ending, where `second` starts. */
  private landsOn(first: PlayingSound, second: PlayingSound): boolean {
    if (first.clip.source.kind !== 'builtin') return false;
    const riser = this.sounds.find(first.clip.source.soundId);
    if (riser === null || riser.category !== 'riser') return false;
    return second.outputSec - first.outputSec <= riser.lengthSec + CrowdedSoundFinder.LANDING_SLACK_SEC;
  }

  private isLater(sound: PlayingSound, than: PlayingSound): boolean {
    return sound.outputSec > than.outputSec || (sound.outputSec === than.outputSec && sound.order > than.order);
  }

  private earlier(one: PlayingSound, other: PlayingSound): PlayingSound {
    return this.isLater(one, other) ? other : one;
  }

  private later(one: PlayingSound, other: PlayingSound): PlayingSound {
    return this.isLater(one, other) ? one : other;
  }
}
