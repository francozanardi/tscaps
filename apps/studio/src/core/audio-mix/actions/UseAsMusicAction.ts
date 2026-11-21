import type { AudioMixTelemetryReporter, MusicOrigin } from '@core/audio-mix/services/AudioMixTelemetryReporter';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Makes a file the project's music. Where there is music already, its
 * file is replaced and it plays the new one from the start, keeping its
 * level, fades, loop and lowering; where there is none, a music clip is
 * added with the role's defaults, spanning the whole video. One undo
 * step either way, and none where the file already is the music.
 *
 * The project holds one piece of music: the first music clip is the
 * one replaced, and any other is left as it is.
 */
export class UseAsMusicAction {
  constructor(
    private readonly store: EditorStore,
    private readonly defaults: AudioClipDefaults,
    private readonly telemetry: AudioMixTelemetryReporter,
  ) {}

  /**
   * The music clip's id, or null where `source` names no file. `origin`
   * says where in the editor the file was picked; it changes nothing but
   * what is reported.
   */
  execute(source: AudioSourceRef, origin: MusicOrigin): string | null {
    const current = this.store.snapshot().audio;
    const music = current.clips().find((clip) => clip.role === 'music') ?? null;
    return music === null ? this.added(current, source, origin) : this.replaced(current, music, source, origin);
  }

  private added(current: AudioMix, source: AudioSourceRef, origin: MusicOrigin): string | null {
    const clip = this.defaults.clipFrom(crypto.randomUUID(), { role: 'music', source });
    const next = current.withClipAdded(clip);
    if (next === current) return null;
    this.store.commit('Add music');
    this.store.patch({ audio: next });
    this.telemetry.musicSet(source, origin, false);
    return clip.id;
  }

  private replaced(current: AudioMix, music: AudioClip, source: AudioSourceRef, origin: MusicOrigin): string | null {
    const next = current.withClipsPatched([music.id], { source, inSec: 0 });
    if (next === current) return this.isSameSource(music.source, source) ? music.id : null;
    this.store.commit('Change music');
    this.store.patch({ audio: next });
    this.telemetry.musicSet(source, origin, true);
    return music.id;
  }

  private isSameSource(first: AudioSourceRef, second: AudioSourceRef): boolean {
    if (first.kind === 'media') return second.kind === 'media' && second.mediaId === first.mediaId;
    return second.kind === 'builtin' && second.soundId === first.soundId;
  }
}
