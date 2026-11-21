import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioClipDraft } from '@core/audio-mix/domain/AudioClipDraft';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { ShotTransition, ShotTransitionKind } from '@core/shots/domain/ShotTransition';

/**
 * A sound of the bundled pack, how far before the cut it starts, and how
 * loud it plays. The offset is the moment its sound is loudest, measured
 * on the file (50 ms windows), so that moment lands on the cut. The
 * volume is the owner's, set by ear: a transition's sound sits under the
 * speech, it does not cover it.
 */
interface ShotTransitionSound {
  readonly soundId: string;
  readonly offsetSec: number;
  readonly volume: number;
}

// A dip to black and an iris suggest nothing: they read as quiet.
const SUGGESTIONS: Readonly<Record<ShotTransitionKind, ShotTransitionSound | null>> = {
  'flash': { soundId: 'impact-hit', offsetSec: -0.04, volume: 0.09 },
  'fade-white': { soundId: 'whoosh-pass', offsetSec: -0.35, volume: 0.05 },
  'fade-black': null,
  'blur': { soundId: 'whoosh-soft', offsetSec: -0.09, volume: 0.065 },
  'whip': { soundId: 'whoosh-fast', offsetSec: -0.1, volume: 0.056 },
  'whip-up': { soundId: 'swish-heavy', offsetSec: -0.04, volume: 0.3 },
  'spin': { soundId: 'whoosh-deep', offsetSec: -0.39, volume: 0.1 },
  'shake': { soundId: 'impact-punch', offsetSec: -0.03, volume: 0.5 },
  'glitch': { soundId: 'glitch', offsetSec: -0.08, volume: 0.15 },
  'wipe': { soundId: 'swish', offsetSec: -0.05, volume: 0.25 },
  'iris': null,
};

/**
 * The sound each transition suggests, placed as an ordinary sound
 * effect on the transition itself (its cut), apart from the sounds on
 * the shot's start: it is listed with the transition's sounds and edited
 * like any other. The clip that stands for a transition's suggestion is
 * the effect on that transition playing that sound, whoever placed it.
 */
export class ShotTransitionSoundSuggestions {
  /** The suggested sound of `kind` into `shotId`, as a clip to add; null for a kind that suggests none. */
  draftFor(shotId: string, kind: ShotTransitionKind): AudioClipDraft | null {
    const suggestion = SUGGESTIONS[kind];
    if (suggestion === null) return null;
    const { soundId, offsetSec, volume } = suggestion;
    return {
      role: 'effect',
      source: { kind: 'builtin', soundId },
      start: { anchor: { kind: 'transition', shotId }, offsetSec },
      volume,
    };
  }

  /**
   * Whether a transition picked into `shotId` next should come with its
   * suggested sound, `held` being the one it has now: yes on a plain
   * cut and after a kind that suggests none, and otherwise only where
   * the held kind's sound is still there, so a sound taken off stays off
   * as the kind changes.
   */
  keepsSound(mix: AudioMix, shotId: string, held: ShotTransition | null): boolean {
    if (held === null || SUGGESTIONS[held.kind] === null) return true;
    return this.clipIn(mix, shotId, held.kind) !== null;
  }

  /** The clip in `mix` that is `kind`'s suggested sound into `shotId`, or null where none is. */
  clipIn(mix: AudioMix, shotId: string, kind: ShotTransitionKind): AudioClip | null {
    const suggestion = SUGGESTIONS[kind];
    if (suggestion === null) return null;
    const { soundId } = suggestion;
    return mix.clips().find((clip) => clip.role === 'effect'
      && clip.source.kind === 'builtin'
      && clip.source.soundId === soundId
      && clip.start.anchor.kind === 'transition'
      && clip.start.anchor.shotId === shotId) ?? null;
  }

  /** Every clip in `mix` placed on the transition into `shotId`, suggested or not. */
  clipsOn(mix: AudioMix, shotId: string): AudioClip[] {
    return mix.clips().filter((clip) => clip.start.anchor.kind === 'transition' && clip.start.anchor.shotId === shotId);
  }
}
