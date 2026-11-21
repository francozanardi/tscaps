import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioClipDraft } from '@core/audio-mix/domain/AudioClipDraft';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { ShotCameraTarget } from '@core/shots/domain/ShotCameraTarget';

/**
 * A sound of the bundled pack that goes with a camera preset: when its
 * sound is loudest (`peakSec`, measured on the file in 50 ms windows),
 * where the preset's move is fastest (`fastest`: as the shot starts, or
 * half way through an eased move) and how loud it plays, as the owner
 * tuned it by ear for each move.
 */
interface ShotCameraSound {
  readonly soundId: string;
  readonly peakSec: number;
  readonly volume: number;
  readonly fastest: 'start' | 'middle';
}

// Sounds about as long as their moves; the rest of the presets suggest none.
const SOUNDS: Readonly<Record<string, ShotCameraSound>> = {
  'layer-zoom-in-camera': { soundId: 'whoosh-deep', peakSec: 0.39, volume: 0.07, fastest: 'middle' },
  'layer-fast-zoom-in-camera': { soundId: 'whoosh-fast', peakSec: 0.1, volume: 0.056, fastest: 'start' },
  'layer-crash-zoom-camera': { soundId: 'swish-heavy', peakSec: 0.04, volume: 0.3, fastest: 'start' },
  'layer-zoom-out-reveal-camera': { soundId: 'whoosh-soft', peakSec: 0.09, volume: 0.065, fastest: 'start' },
  'layer-bounce-camera': { soundId: 'swish', peakSec: 0.05, volume: 0.2, fastest: 'start' },
};

/**
 * The sound a camera preset brings, placed as an ordinary sound effect
 * on the camera: a shot's (`{ kind: 'camera' }`, which lands on the
 * shot's start) or a layer's (`{ kind: 'layer-camera' }`, on the layer's
 * start), apart from the sounds at those starts, the way a transition's
 * suggested sound sits on the transition: it is listed with the camera's
 * sounds and edited like any other. The clip that stands for a preset's
 * sound is the effect on that camera playing that sound, whoever placed
 * it.
 */
export class ShotCameraSounds {
  /** Where `target`'s camera sounds are anchored. */
  anchorOf(target: ShotCameraTarget): AudioAnchor {
    return target.kind === 'shot' ? { kind: 'camera', shotId: target.shotId } : { kind: 'layer-camera', layerId: target.layerId };
  }

  /** The preset `presetId`'s sound on `target`'s camera, for a move lasting `durationSec` (null for the whole stretch); null for a preset with none. */
  draftFor(target: ShotCameraTarget, presetId: string, durationSec: number | null): AudioClipDraft | null {
    const sound = SOUNDS[presetId];
    if (sound === undefined) return null;
    return {
      role: 'effect',
      source: { kind: 'builtin', soundId: sound.soundId },
      start: { anchor: this.anchorOf(target), offsetSec: this.offsetFor(presetId, durationSec) },
      volume: sound.volume,
    };
  }

  /** How far from the camera's start the preset's sound plays, for a move lasting `durationSec`; 0 for a preset with none. */
  offsetFor(presetId: string, durationSec: number | null): number {
    const sound = SOUNDS[presetId];
    if (sound === undefined) return 0;
    const fastestSec = sound.fastest === 'middle' && durationSec !== null ? durationSec / 2 : 0;
    return Number((fastestSec - sound.peakSec).toFixed(3));
  }

  /** The clip in `mix` that is the preset `presetId`'s sound on `target`'s camera, or null where none is. */
  clipIn(mix: AudioMix, target: ShotCameraTarget, presetId: string): AudioClip | null {
    const sound = SOUNDS[presetId];
    if (sound === undefined) return null;
    return mix.clips().find((clip) => clip.role === 'effect'
      && clip.source.kind === 'builtin'
      && clip.source.soundId === sound.soundId
      && this.isOn(clip.start.anchor, target)) ?? null;
  }

  /** Every clip in `mix` placed on `target`'s camera, its preset's or not. */
  clipsOn(mix: AudioMix, target: ShotCameraTarget): AudioClip[] {
    return mix.clips().filter((clip) => this.isOn(clip.start.anchor, target));
  }

  private isOn(anchor: AudioAnchor, target: ShotCameraTarget): boolean {
    return target.kind === 'shot'
      ? anchor.kind === 'camera' && anchor.shotId === target.shotId
      : anchor.kind === 'layer-camera' && anchor.layerId === target.layerId;
  }
}
