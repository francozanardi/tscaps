import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioClipPatch } from '@core/audio-mix/domain/AudioClipPatch';
import { AudioMixSanitizer } from '@core/audio-mix/domain/AudioMixSanitizer';
import type { FootageSound } from '@core/audio-mix/domain/FootageSound';
import type { ShotVideoVolume } from '@core/audio-mix/domain/ShotVideoVolume';

export interface AudioMixSnapshot {
  readonly sourceVolume: number;
  readonly clips: ReadonlyArray<AudioClip>;
  /** The shot layers whose file's own sound is heard; absent where none is. */
  readonly footageSounds?: ReadonlyArray<FootageSound>;
  /** The shots that play the video's own sound at a level other than 1; absent where none does. */
  readonly shotVideoVolumes?: ReadonlyArray<ShotVideoVolume>;
}

/**
 * The project's soundtrack: the video's own level, overall and in each
 * shot that changes it, every clip mixed over it, and the shot
 * layers whose file's own sound is heard while they show. Immutable;
 * every mutation returns a new instance, or this one where nothing
 * would change.
 *
 * It belongs to the project, not to a caption track: switching to a
 * translation changes the captions, never what is heard. Clips are
 * unordered — when each plays comes from its anchors — and a clip id
 * names one clip: an edit that would give two clips one id is refused,
 * and a stored second one is dropped. Everything written or read is
 * checked by {@link AudioMixSanitizer}.
 *
 * A clip whose anchors are gone is kept, and so is the sound of a layer
 * or the video's level of a shot that is gone: an undo brings back what they
 * name, and them with it.
 */
export class AudioMix {
  private static readonly sanitizer = new AudioMixSanitizer();

  static empty(): AudioMix {
    return new AudioMix(1, [], [], new Map());
  }

  /** Reads a stored mix; anything that cannot be trusted is dropped or falls back, as the sanitizer says. */
  static fromSnapshot(value: unknown): AudioMix {
    if (typeof value !== 'object' || value === null) return AudioMix.empty();
    const raw = value as Record<string, unknown>;
    const clips: AudioClip[] = [];
    const seenIds = new Set<string>();
    for (const entry of Array.isArray(raw['clips']) ? raw['clips'] : []) {
      const clip = AudioMix.sanitizer.sanitizeClip(entry);
      if (clip === null || seenIds.has(clip.id)) continue;
      seenIds.add(clip.id);
      clips.push(clip);
    }
    return new AudioMix(
      AudioMix.sanitizer.sanitizeSourceVolume(raw['sourceVolume']),
      clips,
      AudioMix.readFootageSounds(raw['footageSounds']),
      AudioMix.readShotVideoVolumes(raw['shotVideoVolumes']),
    );
  }

  /** The stored layer sounds that can be trusted, one per layer, the first kept; a level of 0 is no entry. */
  private static readFootageSounds(value: unknown): FootageSound[] {
    const sounds: FootageSound[] = [];
    for (const entry of Array.isArray(value) ? value : []) {
      const sound = AudioMix.sanitizer.sanitizeFootageSound(entry);
      if (sound !== null && sound.volume > 0 && !sounds.some((held) => held.layerId === sound.layerId)) sounds.push(sound);
    }
    return sounds;
  }

  /** The stored shot levels that can be trusted, the first kept per shot; a level of 1 is no entry. */
  private static readShotVideoVolumes(value: unknown): Map<string, number> {
    const volumes = new Map<string, number>();
    for (const entry of Array.isArray(value) ? value : []) {
      const volume = AudioMix.sanitizer.sanitizeShotVideoVolume(entry);
      if (volume !== null && volume.volume !== 1 && !volumes.has(volume.shotId)) volumes.set(volume.shotId, volume.volume);
    }
    return volumes;
  }

  private constructor(
    /** The video's own sound, linear 0 to 2. */
    readonly sourceVolume: number,
    private readonly clipList: readonly AudioClip[],
    private readonly footageSoundList: readonly FootageSound[],
    /** By shot id; a shot not held plays the video at 1. */
    private readonly shotVolumes: ReadonlyMap<string, number>,
  ) {}

  clips(): readonly AudioClip[] {
    return this.clipList;
  }

  /** The clip `clipId` names, or null where none does. */
  clip(clipId: string): AudioClip | null {
    return this.clipList.find((clip) => clip.id === clipId) ?? null;
  }

  hasClips(): boolean {
    return this.clipList.length > 0;
  }

  /** The shot layers whose file's own sound is heard, in the order they were turned on. */
  footageSounds(): readonly FootageSound[] {
    return this.footageSoundList;
  }

  /** How loud the file of the layer `layerId` is heard: 0, the default, plays it in silence. */
  footageVolumeOf(layerId: string): number {
    return this.footageSoundList.find((sound) => sound.layerId === layerId)?.volume ?? 0;
  }

  /** Whether some sound is added over the video's own: a clip, or a layer's file heard. */
  hasSounds(): boolean {
    return this.hasClips() || this.footageSoundList.length > 0;
  }

  /** How loud the video's own sound is during the shot `shotId`, on top of its overall level: 1 where it was not changed. */
  shotVideoVolumeOf(shotId: string): number {
    return this.shotVolumes.get(shotId) ?? 1;
  }

  /** The shots whose video level is not 1, by shot id. */
  shotVideoVolumes(): ReadonlyMap<string, number> {
    return this.shotVolumes;
  }

  hasShotVideoVolumes(): boolean {
    return this.shotVolumes.size > 0;
  }

  /** Nothing added, no shot's level changed and the video at its own level: nothing worth storing. */
  isPristine(): boolean {
    return !this.hasSounds() && !this.hasShotVideoVolumes() && this.sourceVolume === 1;
  }

  /** The media files some clip plays. Sounds of the bundled pack are not media files. */
  mediaIdsInUse(): ReadonlySet<string> {
    return new Set(this.clipList.flatMap((clip) => (clip.source.kind === 'media' ? [clip.source.mediaId] : [])));
  }

  toSnapshot(): AudioMixSnapshot {
    return {
      sourceVolume: this.sourceVolume,
      clips: this.clipList,
      ...(this.footageSoundList.length === 0 ? {} : { footageSounds: this.footageSoundList }),
      ...(this.shotVolumes.size === 0
        ? {}
        : { shotVideoVolumes: [...this.shotVolumes].map(([shotId, volume]) => ({ shotId, volume })) }),
    };
  }

  /** Adds `clip`, checked first. No-op where it cannot be trusted or some clip already has its id. */
  withClipAdded(clip: AudioClip): AudioMix {
    const sanitized = AudioMix.sanitizer.sanitizeClip(clip);
    if (sanitized === null || this.clip(sanitized.id) !== null) return this;
    return this.withClipList([...this.clipList, sanitized]);
  }

  /**
   * Writes `patch` into every clip `clipIds` names, each checked again
   * afterwards; a clip the patch would leave untrustworthy keeps what it
   * had. Ids no clip has are skipped; the same mix where nothing changes.
   */
  withClipsPatched(clipIds: Iterable<string>, patch: AudioClipPatch): AudioMix {
    const targets = new Set(clipIds);
    let changed = false;
    const clips = this.clipList.map((clip) => {
      if (!targets.has(clip.id)) return clip;
      const patched = AudioMix.sanitizer.sanitizeClip(this.patched(clip, patch));
      if (patched === null || this.isSameClip(clip, patched)) return clip;
      changed = true;
      return patched;
    });
    return changed ? this.withClipList(clips) : this;
  }

  /** Takes away every clip `clipIds` names. The same mix where none of them is held. */
  withoutClips(clipIds: Iterable<string>): AudioMix {
    const gone = new Set(clipIds);
    if (!this.clipList.some((clip) => gone.has(clip.id))) return this;
    return this.withClipList(this.clipList.filter((clip) => !gone.has(clip.id)));
  }

  /** Takes away every clip playing the media file `mediaId`. The same mix when none does. */
  withoutMedia(mediaId: string): AudioMix {
    if (!this.mediaIdsInUse().has(mediaId)) return this;
    return this.withClipList(this.clipList.filter((clip) => clip.source.kind !== 'media' || clip.source.mediaId !== mediaId));
  }

  /** Sets the video's own level, clamped. The same mix where it does not change. */
  withSourceVolume(volume: number): AudioMix {
    const sanitized = AudioMix.sanitizer.sanitizeSourceVolume(volume);
    if (sanitized === this.sourceVolume) return this;
    return new AudioMix(sanitized, this.clipList, this.footageSoundList, this.shotVolumes);
  }

  /**
   * Has the file of every layer `layerIds` names heard at `volume`,
   * clamped to 0 to 2; at 0, the default, played in silence again.
   * Whether a layer shows a file with sound is not known here; the
   * caller says. The same mix where nothing changes.
   */
  withFootageSound(layerIds: Iterable<string>, volume: number): AudioMix {
    const targets = new Set(layerIds);
    const sounds = !(volume > 0)
      ? this.footageSoundList.filter((sound) => !targets.has(sound.layerId))
      : this.footageHeardAt(targets, volume);
    if (this.isSameFootage(sounds)) return this;
    return new AudioMix(this.sourceVolume, this.clipList, sounds, this.shotVolumes);
  }

  /**
   * Sets how loud the video's own sound is during every shot `shotIds`
   * names, clamped to 0 to 2; 0 silences it there, 1 is the video's
   * overall level. The same mix where nothing changes.
   */
  withShotVideoVolume(shotIds: Iterable<string>, volume: number): AudioMix {
    const next = new Map(this.shotVolumes);
    for (const shotId of shotIds) {
      const sanitized = AudioMix.sanitizer.sanitizeShotVideoVolume({ shotId, volume });
      if (sanitized === null) continue;
      if (sanitized.volume === 1) next.delete(sanitized.shotId);
      else next.set(sanitized.shotId, sanitized.volume);
    }
    const unchanged = next.size === this.shotVolumes.size
      && [...next].every(([shotId, held]) => this.shotVolumes.get(shotId) === held);
    return unchanged ? this : new AudioMix(this.sourceVolume, this.clipList, this.footageSoundList, next);
  }

  private withClipList(clips: readonly AudioClip[]): AudioMix {
    return new AudioMix(this.sourceVolume, clips, this.footageSoundList, this.shotVolumes);
  }

  /** Every layer sound, those of `layerIds` at `volume` where they stand, and the layers not heard yet after them. */
  private footageHeardAt(layerIds: ReadonlySet<string>, volume: number): FootageSound[] {
    const changed = this.footageSoundList.map((sound) => (layerIds.has(sound.layerId) ? { layerId: sound.layerId, volume } : sound));
    const added = [...layerIds].filter((layerId) => this.footageVolumeOf(layerId) === 0).map((layerId) => ({ layerId, volume }));
    return [...changed, ...added].flatMap((sound) => {
      const sanitized = AudioMix.sanitizer.sanitizeFootageSound(sound);
      return sanitized === null ? [] : [sanitized];
    });
  }

  private isSameFootage(sounds: readonly FootageSound[]): boolean {
    return sounds.length === this.footageSoundList.length
      && sounds.every((sound, index) => {
        const held = this.footageSoundList[index]!;
        return held.layerId === sound.layerId && held.volume === sound.volume;
      });
  }

  private patched(clip: AudioClip, patch: AudioClipPatch): AudioClip {
    const { ducking, startOffsetSec, ...rest } = patch;
    const start = rest.start ?? clip.start;
    return {
      ...clip,
      ...rest,
      start: startOffsetSec === undefined ? start : { ...start, offsetSec: startOffsetSec },
      ducking: { ...clip.ducking, ...ducking },
    };
  }

  private isSameClip(first: AudioClip, second: AudioClip): boolean {
    // Both came out of the sanitizer, which writes every field, nested
    // ones included, in one order: equal text is an equal clip.
    return JSON.stringify(first) === JSON.stringify(second);
  }
}
