import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import type { SuggestedSoundMatcher } from '@core/audio-mix/services/SuggestedSoundMatcher';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';
import type { TelemetryEventProperties } from '@shared/telemetry';

/** Where a file was made the music from: the Audio tab, or a file's menu in the media bin. */
export type MusicOrigin = 'audio-tab' | 'media-bin';

/** Why a sound could not be had: its file could not be read, or this browser cannot decode it. */
export type AudioSourceUnavailableReason = 'read-failed' | 'undecodable';

const EVENT_CAP = 30;

/**
 * Reports what is done to the soundtrack by hand: a sound effect added or
 * taken off, the music set, taken off or lowered under speech, and a
 * sound that could not be had.
 *
 * A sound is described by where it is anchored and whether it is a
 * bundled sound, named by its id and category, or a file of the user's,
 * never named at all. Each event goes out at most 30 times a page load;
 * a sound that could not be had is reported once per sound. A sound
 * taken off says whether it was the one the editor suggests for what it
 * sits on, which is how the suggestions are judged.
 */
export class AudioMixTelemetryReporter {
  constructor(
    private readonly telemetry: Telemetry,
    private readonly budget: TelemetryBudget,
    private readonly builtinSounds: BuiltinSoundCatalog,
    private readonly suggestions: SuggestedSoundMatcher,
  ) {}

  /** `replaced` is whether the effect took the place of others, as a swap does. */
  effectAdded(clip: AudioClip, replaced: boolean): void {
    if (!this.budget.allows('sound_effect_added', EVENT_CAP)) return;
    this.telemetry.capture('sound_effect_added', {
      anchor: clip.start.anchor.kind,
      ...this.sourceProperties(clip.source),
      replaced,
    });
  }

  /** `state` is the editor as it was before the clips were taken off. */
  clipsRemoved(state: EditorState, clips: ReadonlyArray<AudioClip>): void {
    for (const clip of clips) {
      if (clip.role === 'music') this.musicRemoved();
      else this.effectRemoved(state, clip);
    }
  }

  musicSet(source: AudioSourceRef, origin: MusicOrigin, replaced: boolean): void {
    if (!this.budget.allows('music_set', EVENT_CAP)) return;
    this.telemetry.capture('music_set', { source: this.kindOf(source), origin, replaced });
  }

  duckingToggled(enabled: boolean): void {
    if (!this.budget.allows('music_ducking_toggled', EVENT_CAP)) return;
    this.telemetry.capture('music_ducking_toggled', { enabled });
  }

  sourceUnavailable(source: AudioSourceRef, reason: AudioSourceUnavailableReason): void {
    const key = source.kind === 'builtin' ? `builtin:${source.soundId}` : `media:${source.mediaId}`;
    if (!this.budget.allows(`audio_source_unavailable:${key}`, 1)) return;
    this.telemetry.capture('audio_source_unavailable', {
      source: this.kindOf(source),
      sound_id: source.kind === 'builtin' ? source.soundId : null,
      reason,
    });
  }

  private effectRemoved(state: EditorState, clip: AudioClip): void {
    if (!this.budget.allows('sound_effect_removed', EVENT_CAP)) return;
    this.telemetry.capture('sound_effect_removed', {
      anchor: clip.start.anchor.kind,
      ...this.sourceProperties(clip.source),
      was_suggestion: this.suggestions.isSuggested(state, clip),
    });
  }

  private musicRemoved(): void {
    if (!this.budget.allows('music_removed', EVENT_CAP)) return;
    this.telemetry.capture('music_removed', {});
  }

  private sourceProperties(source: AudioSourceRef): TelemetryEventProperties {
    if (source.kind === 'media') return { source: 'file', sound_id: null, category: null };
    return {
      source: 'builtin',
      sound_id: source.soundId,
      category: this.builtinSounds.find(source.soundId)?.category ?? null,
    };
  }

  private kindOf(source: AudioSourceRef): 'builtin' | 'file' {
    return source.kind === 'builtin' ? 'builtin' : 'file';
  }
}
