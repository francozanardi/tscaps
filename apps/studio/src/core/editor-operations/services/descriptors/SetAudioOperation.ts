import { z } from 'zod';
import type { PatchAudioClipsAction } from '@core/audio-mix/actions/PatchAudioClipsAction';
import type { RemoveAudioClipsAction } from '@core/audio-mix/actions/RemoveAudioClipsAction';
import type { SetFootageSoundAction } from '@core/audio-mix/actions/SetFootageSoundAction';
import type { SetShotVideoVolumeAction } from '@core/audio-mix/actions/SetShotVideoVolumeAction';
import type { SetSourceVolumeAction } from '@core/audio-mix/actions/SetSourceVolumeAction';
import type { UseAsMusicAction } from '@core/audio-mix/actions/UseAsMusicAction';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioClipPatch } from '@core/audio-mix/domain/AudioClipPatch';
import { AudioMixSanitizer } from '@core/audio-mix/domain/AudioMixSanitizer';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { ResolvedRef } from '@core/editor-operations/domain/ResolvedRef';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';

/** One shot's or one layer's new level, its ref checked. */
interface LevelChange {
  readonly id: string;
  readonly ref: string;
  readonly volume: number;
}

/** A placed sound's new settings, its ref checked. */
interface SoundChange {
  readonly id: string;
  readonly ref: string;
  readonly patch: AudioClipPatch;
}

/** What happens to the music: taken away, or its file set (null keeps it) and its settings patched. */
type MusicChange =
  | { readonly kind: 'remove'; readonly clipIds: ReadonlyArray<string> }
  | { readonly kind: 'set'; readonly source: AudioSourceRef | null; readonly patch: AudioClipPatch };

/** Everything a run changes, every part checked; a part left out is not touched. */
interface AudioChanges {
  readonly videoVolume: number | undefined;
  readonly shots: ReadonlyArray<LevelChange>;
  readonly layers: ReadonlyArray<LevelChange>;
  readonly music: MusicChange | null;
  readonly sounds: ReadonlyArray<SoundChange>;
}

/** The music fields of the input. */
interface MusicInput {
  readonly media?: string | undefined;
  readonly volume?: number | undefined;
  readonly inSec?: number | undefined;
  readonly fadeInSec?: number | undefined;
  readonly fadeOutSec?: number | undefined;
  readonly loop?: boolean | undefined;
  readonly ducking?: boolean | undefined;
  readonly duckingDb?: number | undefined;
}

// A file named the way a ref is written; the id after it is what the media list holds.
const MEDIA_PREFIX = 'media:';
// The UI's nudge: an effect on something of the edit moves a second either way, one on the video's start or end as far as an offset goes.
const NEAR_OFFSET_SEC = 1;

// Shared by every level of the input: declared once in the schema the model reads (`id` puts it under $defs).
const GAIN = z.number().min(0).max(AudioMixSanitizer.MAX_GAIN)
  .meta({ id: 'AudioGain', description: 'Linear gain: 1 as recorded, 0 silent, 2 the loudest.' });

/**
 * `set_audio`: changes the soundtrack's levels and its music in one
 * undo step, through the actions the Audio tab calls: the video's own
 * level, overall and per shot, a b-roll layer's own sound, the music
 * (its file, level, fades, loop and lowering under speech, or taking it
 * away), and the level and nudge of sounds already placed, which keep
 * their refs. Every part is checked before any is written, so a bad
 * part changes nothing. New music starts with the Audio tab's defaults:
 * looping, fading in and out, not lowered under speech.
 */
export class SetAudioOperation implements EditorOperation {
  readonly name = 'set_audio';
  readonly effect = 'edit';
  readonly description = [
    'Changes levels and music; give only what changes. One undo step; any bad part changes nothing.',
    'Volumes are linear gain, as get_project reads them: 1 as recorded, 0 silent, up to 2.',
    'videoVolume: the video\'s own sound; shots: during a shot, on top of it; layers: a b-roll\'s own sound, silent by default (only a video file has one).',
    'music: an audio file under the whole video, added looping with 1 s fade in, 2 s out; null removes it.',
    'Ducking (lowered while someone speaks) stays off unless the person asks.',
    'sounds: a placed sound\'s volume or nudge, effects and those transitions or camera moves bring.',
    'Answers what changed.',
  ].join(' ');

  private readonly input = new OperationInput({
    videoVolume: GAIN.optional(),
    shots: z.array(z.strictObject({ shot: z.string().describe('shot:<id>'), volume: GAIN })).min(1).max(100).optional(),
    layers: z.array(z.strictObject({ layer: z.string().describe('layer:<id>, showing a video file'), volume: GAIN })).min(1).max(100).optional(),
    music: z.strictObject({
      media: z.string().optional().describe('An audio file id (list_catalog media); a new file keeps the settings. Needed when there is no music.'),
      volume: GAIN.optional(),
      inSec: z.number().min(0).optional().describe('Where in the file it starts, s.'),
      fadeInSec: z.number().min(0).max(AudioMixSanitizer.MAX_FADE_SEC).optional(),
      fadeOutSec: z.number().min(0).max(AudioMixSanitizer.MAX_FADE_SEC).optional(),
      loop: z.boolean().optional(),
      ducking: z.boolean().optional(),
      duckingDb: z.number().min(AudioMixSanitizer.MIN_DUCKING_DEPTH_DB).max(0).optional()
        .describe(`How far ducking lowers it, dB (default ${AudioMixSanitizer.DEFAULT_DUCKING_DEPTH_DB}).`),
    }).nullable().optional(),
    sounds: z.array(z.strictObject({
      sound: z.string().describe('sound:<id>'),
      volume: GAIN.optional(),
      offsetSec: z.number().min(-AudioMixSanitizer.MAX_OFFSET_SEC).max(AudioMixSanitizer.MAX_OFFSET_SEC).optional()
        .describe(`From what it is placed on, s: within ±${NEAR_OFFSET_SEC} unless on the video's start or end.`),
    })).min(1).max(100).optional(),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly shots: ShotRefResolver,
    private readonly media: MediaAssetStore,
    private readonly layerAssets: ShotLayerAssetReader,
    private readonly format: ReadoutFormatter,
    private readonly setSourceVolume: SetSourceVolumeAction,
    private readonly setShotVideoVolume: SetShotVideoVolumeAction,
    private readonly setFootageSound: SetFootageSoundAction,
    private readonly useAsMusic: UseAsMusicAction,
    private readonly patchClips: PatchAudioClipsAction,
    private readonly removeClips: RemoveAudioClipsAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const value = checked.value;
    if (Object.values(value).every((field) => field === undefined)) {
      return this.refused([this.problem('Give at least one of videoVolume, shots, layers, music or sounds.')]);
    }
    const state = this.store.snapshot();
    const problems: OperationProblem[] = [];
    const changes: AudioChanges = {
      videoVolume: value.videoVolume,
      shots: this.collected(value.shots ?? [], problems, (entry) => this.shotChange(entry.shot, entry.volume)),
      layers: this.collected(value.layers ?? [], problems, (entry) => this.layerChange(entry.layer, entry.volume)),
      music: value.music === undefined ? null : this.musicChange(value.music, state, problems),
      sounds: this.collected(value.sounds ?? [], problems, (entry, index) => this.soundChange(entry, state, `sounds.${index}`)),
    };
    const errors = problems.filter((problem) => problem.severity === 'error');
    if (errors.length > 0) return this.refused(errors);
    return { ok: true, output: this.applied(changes), problems: [...problems, ...this.duckingWarnings(value.music)] };
  }

  /** The change each of `entries` makes, its problem pushed onto `problems` where it cannot be made. */
  private collected<Entry, Change>(
    entries: ReadonlyArray<Entry>,
    problems: OperationProblem[],
    changeOf: (entry: Entry, index: number) => ResolvedRef<Change>,
  ): Change[] {
    return entries.flatMap((entry, index) => {
      const change = changeOf(entry, index);
      if (change.ok) return [change.value];
      problems.push(change.problem);
      return [];
    });
  }

  private shotChange(ref: string, volume: number): ResolvedRef<LevelChange> {
    const shot = this.shots.resolveShot(ref);
    return shot.ok ? { ok: true, value: { id: shot.value.shot.id, ref: shot.value.ref, volume } } : shot;
  }

  /** The layer `ref` at `volume`, refused unless it shows a video file: nothing else has a sound of its own. */
  private layerChange(ref: string, volume: number): ResolvedRef<LevelChange> {
    const resolved = this.shots.resolveLayer(ref);
    if (!resolved.ok) return resolved;
    const { layer } = resolved.value;
    if ('graphic' in layer) return this.unresolved(`${ref} is a graphic, which has no sound of its own; add_sounds places a sound on it.`, ref);
    const asset = this.layerAssets.read(layer.mediaId, this.media.snapshot());
    if (asset === null) return this.unresolved(`${ref} shows a file the media bin no longer holds, so it has no sound.`, ref);
    if (asset.kind !== 'video') return this.unresolved(`${ref} shows a ${asset.kind === 'image' ? 'picture' : asset.kind}, which has no sound; only a video file has one.`, ref);
    return { ok: true, value: { id: layer.id, ref: resolved.value.ref, volume } };
  }

  private musicChange(music: MusicInput | null, state: EditorState, problems: OperationProblem[]): MusicChange | null {
    const current = this.musicClipsOf(state);
    if (music === null) {
      if (current.length === 0) problems.push({ severity: 'warning', message: 'There is no music to remove.' });
      return { kind: 'remove', clipIds: current.map((clip) => clip.id) };
    }
    const source = music.media === undefined ? null : this.musicSourceOf(music.media);
    if (source !== null && !source.ok) {
      problems.push(source.problem);
      return null;
    }
    if (source === null && current.length === 0) {
      problems.push(this.problem('music: there is no music yet; give media, an audio file id from list_catalog media.'));
      return null;
    }
    const lengthSec = this.lengthOf(source?.value ?? current[0]?.source ?? null);
    if (music.inSec !== undefined && lengthSec !== null && music.inSec >= lengthSec) {
      problems.push(this.problem(`music.inSec: the file is ${this.format.sec(lengthSec)} s long.`));
      return null;
    }
    return { kind: 'set', source: source?.value ?? null, patch: this.musicPatchOf(music) };
  }

  /** The file `text` names, refused unless it is an audio file of the media bin: music plays a file of the person's own. */
  private musicSourceOf(text: string): ResolvedRef<AudioSourceRef> {
    const mediaId = text.startsWith(MEDIA_PREFIX) ? text.slice(MEDIA_PREFIX.length) : text;
    const asset = this.media.snapshot().get(mediaId);
    if (asset === null) return this.unresolved(`music.media: no file has the id "${text}"; list_catalog (media) lists the person's files.`);
    if (asset.type !== 'audio') return this.unresolved(`music.media: "${asset.fileName}" is a ${asset.type} file; only an audio file can be the music.`);
    return { ok: true, value: { kind: 'media', mediaId } };
  }

  private musicPatchOf(music: MusicInput): AudioClipPatch {
    const ducking = {
      ...(music.ducking === undefined ? {} : { enabled: music.ducking }),
      ...(music.duckingDb === undefined ? {} : { depthDb: music.duckingDb }),
    };
    return {
      ...(music.volume === undefined ? {} : { volume: music.volume }),
      ...(music.inSec === undefined ? {} : { inSec: music.inSec }),
      ...(music.fadeInSec === undefined ? {} : { fadeInSec: music.fadeInSec }),
      ...(music.fadeOutSec === undefined ? {} : { fadeOutSec: music.fadeOutSec }),
      ...(music.loop === undefined ? {} : { loop: music.loop }),
      ...(Object.keys(ducking).length === 0 ? {} : { ducking }),
    };
  }

  /** The placed sound `entry` names with its new settings, refused for the music and for a nudge past its range. */
  private soundChange(
    entry: { readonly sound: string; readonly volume?: number | undefined; readonly offsetSec?: number | undefined },
    state: EditorState,
    path: string,
  ): ResolvedRef<SoundChange> {
    const parsed = this.parser.parse(entry.sound);
    if (parsed === null || parsed.kind !== 'sound') return this.unresolved(`"${entry.sound}" is not a sound ref; sound refs look like sound:<id>.`, entry.sound);
    const clip = state.audio.clip(parsed.id);
    if (clip === null) return this.unresolved(`${entry.sound} is not a sound of the project any more; get_project lists the sounds.`, entry.sound);
    if (clip.role === 'music') return this.unresolved(`${entry.sound} is the music: change it with music.`, entry.sound);
    if (entry.volume === undefined && entry.offsetSec === undefined) return this.unresolved(`${path}: give volume or offsetSec.`, entry.sound);
    const limit = clip.start.anchor.kind === 'video' ? AudioMixSanitizer.MAX_OFFSET_SEC : NEAR_OFFSET_SEC;
    if (entry.offsetSec !== undefined && Math.abs(entry.offsetSec) > limit) {
      return this.unresolved(`${path}.offsetSec: a sound placed on something of the edit moves at most ${limit} s from it; remove it and add it where it should play instead.`, entry.sound);
    }
    const patch: AudioClipPatch = {
      ...(entry.volume === undefined ? {} : { volume: entry.volume }),
      ...(entry.offsetSec === undefined ? {} : { startOffsetSec: entry.offsetSec }),
    };
    return { ok: true, value: { id: clip.id, ref: this.parser.formatOf('sound', clip.id), patch } };
  }

  /** Writes every change through the editor's actions and answers each part as the project now holds it. */
  private applied(changes: AudioChanges): Record<string, unknown> {
    if (changes.videoVolume !== undefined) this.setSourceVolume.execute(changes.videoVolume);
    for (const shot of changes.shots) this.setShotVideoVolume.execute([shot.id], shot.volume);
    for (const layer of changes.layers) this.setFootageSound.execute([layer.id], layer.volume);
    const music = changes.music === null ? undefined : this.appliedMusic(changes.music);
    for (const sound of changes.sounds) this.patchClips.execute([sound.id], sound.patch);
    const audio = this.store.snapshot().audio;
    return {
      ...(changes.videoVolume === undefined ? {} : { videoVolume: this.format.share(audio.sourceVolume) }),
      ...(changes.shots.length === 0 ? {} : {
        shots: changes.shots.map((shot) => ({ shot: shot.ref, volume: this.format.share(audio.shotVideoVolumeOf(shot.id)) })),
      }),
      ...(changes.layers.length === 0 ? {} : {
        layers: changes.layers.map((layer) => ({ layer: layer.ref, volume: this.format.share(audio.footageVolumeOf(layer.id)) })),
      }),
      ...(music === undefined ? {} : { music }),
      ...(changes.sounds.length === 0 ? {} : { sounds: changes.sounds.map((sound) => this.soundOf(sound.ref, audio.clip(sound.id))) }),
    };
  }

  /** Applies `change` to the music and answers it as it now plays, or null once it is removed. */
  private appliedMusic(change: MusicChange): Record<string, unknown> | null {
    if (change.kind === 'remove') {
      this.removeClips.execute(change.clipIds);
      return null;
    }
    const clipId = change.source === null
      ? this.musicClipsOf(this.store.snapshot())[0]?.id ?? null
      : this.useAsMusic.execute(change.source, 'audio-tab');
    if (clipId === null) return null;
    if (Object.keys(change.patch).length > 0) this.patchClips.execute([clipId], change.patch);
    const clip = this.store.snapshot().audio.clip(clipId);
    return clip === null ? null : this.musicOf(clip);
  }

  private musicOf(clip: AudioClip): Record<string, unknown> {
    const file = clip.source.kind === 'media' ? this.media.snapshot().get(clip.source.mediaId) : null;
    return {
      sound: this.parser.formatOf('sound', clip.id),
      ...(file === null ? {} : { file: file.fileName }),
      volume: this.format.share(clip.volume),
      inSec: this.format.sec(clip.inSec),
      fadeInSec: this.format.sec(clip.fadeInSec),
      fadeOutSec: this.format.sec(clip.fadeOutSec),
      loop: clip.loop,
      ducking: clip.ducking.enabled,
      duckingDb: clip.ducking.depthDb,
    };
  }

  private soundOf(ref: string, clip: AudioClip | null): Record<string, unknown> {
    if (clip === null) return { sound: ref };
    return { sound: ref, volume: this.format.share(clip.volume), offsetSec: this.format.sec(clip.start.offsetSec) };
  }

  /** A warning where a depth was given to music that is not lowered under speech: it is kept for when it is. */
  private duckingWarnings(music: MusicInput | null | undefined): OperationProblem[] {
    if (music === null || music === undefined || music.duckingDb === undefined) return [];
    const clip = this.musicClipsOf(this.store.snapshot())[0];
    if (clip === undefined || clip.ducking.enabled) return [];
    return [{
      severity: 'warning',
      ref: this.parser.formatOf('sound', clip.id),
      message: 'duckingDb is kept, but the music is not lowered under speech until ducking is true.',
    }];
  }

  private musicClipsOf(state: EditorState): AudioClip[] {
    return state.audio.clips().filter((clip) => clip.role === 'music');
  }

  /** How long `source` plays, in seconds, or null where that is not known. */
  private lengthOf(source: AudioSourceRef | null): number | null {
    if (source === null || source.kind !== 'media') return null;
    const durationSec = this.media.snapshot().get(source.mediaId)?.durationSec ?? null;
    return durationSec !== null && durationSec > 0 ? durationSec : null;
  }

  private unresolved<T>(message: string, ref?: string): ResolvedRef<T> {
    return { ok: false, problem: this.problem(message, ref) };
  }

  private problem(message: string, ref?: string): OperationProblem {
    return ref === undefined ? { severity: 'error', message } : { severity: 'error', message, ref };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
