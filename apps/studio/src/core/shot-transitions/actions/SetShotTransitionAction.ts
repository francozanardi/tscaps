import type { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotEditTelemetryReporter } from '@core/shots/services/ShotEditTelemetryReporter';
import type { ShotTransition } from '@core/shots/domain/ShotTransition';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import type { ShotTransitionSoundSuggestions } from '@core/shot-transitions/domain/ShotTransitionSoundSuggestions';

/**
 * Sets how the picture passes into a shot from the one before it, and
 * whether the transition's suggested sound plays on the cut, as one
 * undo step. A drag of the duration on one shot is one step.
 *
 * The suggested sound is an ordinary effect on the transition (its
 * cut). It is added when asked for, not there yet, and the kind suggests
 * one; it is taken off when the kind changes or the sound is no longer
 * asked for. A plain cut takes every sound on the transition with it.
 * No other sound is touched.
 */
export class SetShotTransitionAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
    private readonly suggestions: ShotTransitionSoundSuggestions,
    private readonly defaults: AudioClipDefaults,
    private readonly telemetry: ShotEditTelemetryReporter,
  ) {}

  /** `transition` null makes the cut a plain one, and takes every sound on the transition with it. */
  execute(shotId: string, transition: ShotTransition | null, withSound: boolean): void {
    const state = this.store.snapshot();
    const current = this.materializer.materializeFrom(state);
    const held = current.list().find((shot) => shot.id === shotId)?.transition ?? null;
    const shots = current.withTransition(shotId, transition);
    const kept = shots === current ? held : transition;
    const audio = this.withSuggestedSound(this.withoutSuggestedSound(state.audio, shotId, held, kept, withSound), shotId, kept, withSound);
    if (shots === current && audio === state.audio) return;
    // Only a change of length alone coalesces: picking another kind is a step of its own.
    const lengthOnly = held !== null && kept !== null && held.kind === kept.kind && audio === state.audio;
    this.store.commit(transition === null ? 'Remove transition' : 'Change transition', lengthOnly ? `shotTransitionLength:${shotId}` : undefined);
    this.store.patch({ shots, audio });
    // A new length or a sound turned on or off is not a pick of a kind, and a length moves with a slider.
    if ((held?.kind ?? null) !== (kept?.kind ?? null)) this.telemetry.transitionSet(kept?.kind ?? null, held?.kind ?? null, withSound);
  }

  /**
   * `audio` without the suggested sound of the transition held, unless it
   * stays (same kind, sound still asked for); without every sound on the
   * transition where it goes.
   */
  private withoutSuggestedSound(
    audio: AudioMix,
    shotId: string,
    held: ShotTransition | null,
    transition: ShotTransition | null,
    withSound: boolean,
  ): AudioMix {
    if (held === null) return audio;
    if (transition === null) return audio.withoutClips(this.suggestions.clipsOn(audio, shotId).map((clip) => clip.id));
    if (transition !== null && transition.kind === held.kind && withSound) return audio;
    const clip = this.suggestions.clipIn(audio, shotId, held.kind);
    return clip === null ? audio : audio.withoutClips([clip.id]);
  }

  private withSuggestedSound(audio: AudioMix, shotId: string, transition: ShotTransition | null, withSound: boolean): AudioMix {
    if (transition === null || !withSound || this.suggestions.clipIn(audio, shotId, transition.kind) !== null) return audio;
    const draft = this.suggestions.draftFor(shotId, transition.kind);
    return draft === null ? audio : audio.withClipAdded(this.defaults.clipFrom(crypto.randomUUID(), draft));
  }
}
