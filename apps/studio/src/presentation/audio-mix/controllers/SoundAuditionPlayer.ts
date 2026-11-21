import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import type { SoundAuditionOutput, SoundAuditionVoice } from '@core/audio-mix/domain/SoundAuditionOutput';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';

/**
 * Plays one sound at a time so it can be heard apart from the preview:
 * a bundled sound from where the pack serves it, a user's file from its
 * original. Playing another sound stops the one playing; playing the one
 * playing stops it. It plays once and stops at its end.
 *
 * A file is heard as it is, from its start. A clip is heard as it is
 * placed: from its in-point, at its volume, and at whatever volume it is
 * given while it plays ({@link follow}). Two clips playing the same file
 * are two sounds.
 *
 * Says which sound is playing from the moment it is asked for, while
 * its file is still read, so a button can show it at once. A file that
 * cannot be read or played stops quietly: hearing nothing is the answer.
 * `stop` ends everything; it can be asked to play again afterwards.
 */
export class SoundAuditionPlayer {
  private voice: SoundAuditionVoice | null = null;
  private playing: string | null = null;
  /** The file the sound playing reads, as {@link keyOf} names it. */
  private sourceKeyPlaying: string | null = null;
  private gainPlaying = 1;
  private request = 0;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly builtinSounds: BuiltinSoundCatalog,
    private readonly mediaBytes: MediaAssetBytesRepository,
    private readonly output: SoundAuditionOutput,
  ) {}

  /** The key of the sound playing or about to, as {@link keyOf} or {@link clipKeyOf} names it; null while nothing plays. */
  playingKey(): string | null {
    return this.playing;
  }

  /** Names a file heard as it is, the way {@link playingKey} answers. */
  keyOf(source: AudioSourceRef): string {
    return source.kind === 'media' ? `media:${source.mediaId}` : `builtin:${source.soundId}`;
  }

  /** Names a clip heard as it is placed, the way {@link playingKey} answers. */
  clipKeyOf(clip: AudioClip): string {
    return `clip:${clip.id}`;
  }

  /** Calls `listener` whenever the sound playing changes. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Plays `source` from its start at its own level, or stops it where it is the sound playing. */
  toggle(source: AudioSourceRef): void {
    const key = this.keyOf(source);
    if (this.playing === key) this.stop();
    else void this.play(key, source, 0, 1);
  }

  /** Plays `clip` from its in-point at its volume, or stops it where it is the sound playing. */
  toggleClip(clip: AudioClip): void {
    const key = this.clipKeyOf(clip);
    if (this.playing === key) this.stop();
    else void this.play(key, clip.source, clip.inSec, clip.volume);
  }

  /**
   * Keeps the clip playing in step with `clips`, as they are now: its
   * volume follows, and it stops where it is gone or plays another file.
   * Nothing changes while no clip plays.
   */
  follow(clips: ReadonlyArray<AudioClip>): void {
    const playing = this.playing;
    if (playing === null || !playing.startsWith('clip:')) return;
    const clip = clips.find((candidate) => this.clipKeyOf(candidate) === playing);
    if (clip === undefined || this.sourceKeyPlaying !== this.keyOf(clip.source)) {
      this.stop();
      return;
    }
    this.gainPlaying = clip.volume;
    this.voice?.setGain(clip.volume);
  }

  stop(): void {
    this.request += 1;
    this.release();
    this.setPlaying(null);
  }

  private async play(key: string, source: AudioSourceRef, startSec: number, gain: number): Promise<void> {
    this.release();
    const request = ++this.request;
    this.sourceKeyPlaying = this.keyOf(source);
    this.gainPlaying = gain;
    this.setPlaying(key);
    const file = await this.fileOf(source);
    if (request !== this.request) return;
    if (file === null) {
      this.stop();
      return;
    }
    // The level may have moved while the file was read.
    this.voice = this.output.play(file, startSec, this.gainPlaying, () => {
      if (request === this.request) this.stop();
    });
  }

  /** A bundled sound's address, or the user's file itself; null where it cannot be had. */
  private async fileOf(source: AudioSourceRef): Promise<string | Blob | null> {
    if (source.kind === 'builtin') return this.builtinSounds.find(source.soundId)?.url ?? null;
    try {
      return await this.mediaBytes.load(source.mediaId, 'original');
    } catch (error) {
      console.warn(`[audio-mix] the audio file ${source.mediaId} could not be read to be heard`, error);
      return null;
    }
  }

  private release(): void {
    this.voice?.stop();
    this.voice = null;
    this.sourceKeyPlaying = null;
  }

  private setPlaying(key: string | null): void {
    if (this.playing === key) return;
    this.playing = key;
    for (const listener of this.listeners) listener();
  }
}
