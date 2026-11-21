import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import type { AudioClip, AudioClipDucking, AudioClipRole } from '@core/audio-mix/domain/AudioClip';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { FootageSound } from '@core/audio-mix/domain/FootageSound';
import type { ShotVideoVolume } from '@core/audio-mix/domain/ShotVideoVolume';

/**
 * The one place a clip, the video's own level, overall and per shot,
 * and the sound of a shot layer's file are checked, for what is read back from storage and for
 * what an edit writes alike.
 *
 * A clip that names no id, no file, or a start anchor of a kind this
 * build does not know is dropped. Anything else that cannot be read
 * falls back rather than losing what the user picked: an end anchor
 * that cannot be read is no end, an edge that cannot be read is the
 * anchor's first, a role that cannot be read is an effect, and every
 * number is clamped to its range or, where it is not a number, takes
 * its neutral value.
 *
 * Only music loops. An effect is a sound placed on a moment, and one
 * that started over would run on to the end of the video, so an
 * effect reads as not looping whatever was stored or patched.
 */
export class AudioMixSanitizer {
  static readonly MAX_GAIN = 2;
  static readonly MAX_FADE_SEC = 10;
  /** Wide enough for music placed by hand; an effect's nudge is the UI's narrower range. */
  static readonly MAX_OFFSET_SEC = 60;
  static readonly MIN_DUCKING_DEPTH_DB = -40;
  static readonly DEFAULT_DUCKING_DEPTH_DB = -12;

  /** `value` as a clip that can be trusted, or null where it cannot be. */
  sanitizeClip(value: unknown): AudioClip | null {
    const raw = this.recordOf(value);
    if (raw === null) return null;
    const id = raw['id'];
    if (typeof id !== 'string' || id === '') return null;
    const source = this.sourceOf(raw['source']);
    const start = this.pointOf(raw['start']);
    if (source === null || start === null) return null;
    const role = this.roleOf(raw['role']);
    return {
      id,
      role,
      source,
      start,
      end: this.pointOf(raw['end']),
      inSec: this.clamped(raw['inSec'], 0, Infinity, 0),
      loop: role === 'music' && raw['loop'] === true,
      volume: this.clamped(raw['volume'], 0, AudioMixSanitizer.MAX_GAIN, 1),
      fadeInSec: this.clamped(raw['fadeInSec'], 0, AudioMixSanitizer.MAX_FADE_SEC, 0),
      fadeOutSec: this.clamped(raw['fadeOutSec'], 0, AudioMixSanitizer.MAX_FADE_SEC, 0),
      ducking: this.duckingOf(raw['ducking']),
    };
  }

  /** The video's own level, linear 0 to 2; 1 where it cannot be read. */
  sanitizeSourceVolume(value: unknown): number {
    return this.clamped(value, 0, AudioMixSanitizer.MAX_GAIN, 1);
  }

  /** `value` as a layer's sound that can be trusted, or null where it names no layer; a level that cannot be read is 1. */
  sanitizeFootageSound(value: unknown): FootageSound | null {
    const raw = this.recordOf(value);
    if (raw === null || !this.isId(raw['layerId'])) return null;
    return { layerId: raw['layerId'], volume: this.clamped(raw['volume'], 0, AudioMixSanitizer.MAX_GAIN, 1) };
  }

  /** `value` as a shot's video level that can be trusted, or null where it names no shot; a level that cannot be read is 1. */
  sanitizeShotVideoVolume(value: unknown): ShotVideoVolume | null {
    const raw = this.recordOf(value);
    if (raw === null || !this.isId(raw['shotId'])) return null;
    return { shotId: raw['shotId'], volume: this.clamped(raw['volume'], 0, AudioMixSanitizer.MAX_GAIN, 1) };
  }

  private roleOf(value: unknown): AudioClipRole {
    return value === 'music' ? 'music' : 'effect';
  }

  private sourceOf(value: unknown): AudioSourceRef | null {
    const raw = this.recordOf(value);
    if (raw === null) return null;
    if (raw['kind'] === 'media' && this.isId(raw['mediaId'])) return { kind: 'media', mediaId: raw['mediaId'] };
    if (raw['kind'] === 'builtin' && this.isId(raw['soundId'])) return { kind: 'builtin', soundId: raw['soundId'] };
    return null;
  }

  private pointOf(value: unknown): AudioAnchorPoint | null {
    const raw = this.recordOf(value);
    if (raw === null) return null;
    const anchor = this.anchorOf(raw['anchor']);
    if (anchor === null) return null;
    const max = AudioMixSanitizer.MAX_OFFSET_SEC;
    return { anchor, offsetSec: this.clamped(raw['offsetSec'], -max, max, 0) };
  }

  private anchorOf(value: unknown): AudioAnchor | null {
    const raw = this.recordOf(value);
    if (raw === null) return null;
    const edge = raw['edge'];
    switch (raw['kind']) {
      case 'word':
        return this.isId(raw['wordId']) ? { kind: 'word', wordId: raw['wordId'], edge: edge === 'end' ? 'end' : 'start' } : null;
      case 'emoji':
        return this.isId(raw['decorationId']) ? { kind: 'emoji', decorationId: raw['decorationId'] } : null;
      case 'shot':
        return this.isId(raw['shotId']) ? { kind: 'shot', shotId: raw['shotId'], edge: edge === 'end' ? 'end' : 'start' } : null;
      case 'transition':
        return this.isId(raw['shotId']) ? { kind: 'transition', shotId: raw['shotId'] } : null;
      case 'camera':
        return this.isId(raw['shotId']) ? { kind: 'camera', shotId: raw['shotId'] } : null;
      case 'layer-camera':
        return this.isId(raw['layerId']) ? { kind: 'layer-camera', layerId: raw['layerId'] } : null;
      case 'layer-transition':
        return this.isId(raw['layerId']) ? { kind: 'layer-transition', layerId: raw['layerId'], edge: edge === 'exit' ? 'exit' : 'entrance' } : null;
      case 'layer-moment':
        return this.isId(raw['layerId']) && this.isId(raw['momentId'])
          ? { kind: 'layer-moment', layerId: raw['layerId'], momentId: raw['momentId'] }
          : null;
      case 'layer':
        return this.isId(raw['layerId']) ? { kind: 'layer', layerId: raw['layerId'], edge: edge === 'exit' ? 'exit' : 'entry' } : null;
      case 'video':
        return { kind: 'video', edge: edge === 'end' ? 'end' : 'start' };
      default:
        return null;
    }
  }

  private duckingOf(value: unknown): AudioClipDucking {
    const raw = this.recordOf(value) ?? {};
    return {
      enabled: raw['enabled'] === true,
      depthDb: this.clamped(
        raw['depthDb'],
        AudioMixSanitizer.MIN_DUCKING_DEPTH_DB,
        0,
        AudioMixSanitizer.DEFAULT_DUCKING_DEPTH_DB,
      ),
    };
  }

  private clamped(value: unknown, min: number, max: number, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  private isId(value: unknown): value is string {
    return typeof value === 'string' && value !== '';
  }

  private recordOf(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
  }
}
