import type { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotEditTelemetryReporter } from '@core/shots/services/ShotEditTelemetryReporter';
import type { ElementFieldValues } from '@core/elements/domain/ElementStyles';
import type { SetShotLayerInsetTransitionAction } from '@core/shots/actions/SetShotLayerInsetTransitionAction';
import type { SetShotLayerSplitTransitionAction } from '@core/shots/actions/SetShotLayerSplitTransitionAction';
import type { ShotLayerInsetTransitionKind, ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import type { ShotLayerSplitTransitionKind, ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type {
  LayerTransitionEdge,
  LayerTransitionKind,
  LayerTransitionSoundSuggestions,
} from '@core/shot-transitions/domain/LayerTransitionSoundSuggestions';

/** One end of a layer's transition as a pick reads it: the kind it plays, and whether that kind was picked rather than left to the default. */
interface HeldTransition {
  readonly kind: LayerTransitionKind | 'cut';
  readonly picked: boolean;
}

/**
 * Picks how a split's line or a box moves at one end of shot layers, and
 * the sound that plays with it, for one layer or several, as one undo
 * step.
 *
 * Each layer's suggested sound is an ordinary effect on its transition.
 * A pick of another kind brings the new kind's sound in place of the old
 * kind's, unless the old kind was picked and its sound taken off since;
 * a kind left to the default (a split slides unless told) has no sound
 * of its own to have been taken off. A cut takes every sound on that
 * transition with it. Re-picking the kind a layer has changes no sound,
 * and no other sound is touched.
 */
export class SetShotLayerTransitionAction {
  constructor(
    private readonly store: EditorStore,
    private readonly splits: SetShotLayerSplitTransitionAction,
    private readonly insets: SetShotLayerInsetTransitionAction,
    private readonly splitTransitions: ShotLayerSplitTransitions,
    private readonly insetTransitions: ShotLayerInsetTransitions,
    private readonly suggestions: LayerTransitionSoundSuggestions,
    private readonly defaults: AudioClipDefaults,
    private readonly telemetry: ShotEditTelemetryReporter,
  ) {}

  /** Gives every split layer of `layerIds` the line's transition `kind` at `edge`, with its sound. */
  pickSplit(layerIds: ReadonlyArray<string>, edge: LayerTransitionEdge, kind: ShotLayerSplitTransitionKind): void {
    const changed = this.pick(layerIds, edge, kind, (shots) => this.splits.withKind(shots, layerIds, edge, kind), (fields) => ({
      kind: this.splitTransitions.kindOf(fields, edge),
      picked: fields?.[this.splitTransitions.kindFieldOf(edge)] !== undefined,
    }));
    if (changed) this.telemetry.layerTransitionSet('split', edge, kind, layerIds.length);
  }

  /** Gives every box layer of `layerIds` the transition `kind` at `edge`, with its sound. */
  pickInset(layerIds: ReadonlyArray<string>, edge: LayerTransitionEdge, kind: ShotLayerInsetTransitionKind): void {
    const changed = this.pick(layerIds, edge, kind, (shots) => this.insets.withKind(shots, layerIds, edge, kind), (fields) => ({
      kind: this.insetTransitions.kindOf(fields, edge),
      picked: fields?.[this.insetTransitions.kindFieldOf(edge)] !== undefined,
    }));
    if (changed) this.telemetry.layerTransitionSet('inset', edge, kind, layerIds.length);
  }

  private pick(
    layerIds: ReadonlyArray<string>,
    edge: LayerTransitionEdge,
    kind: LayerTransitionKind | 'cut',
    revise: (shots: ShotPartition) => ShotPartition,
    heldOf: (fields: ElementFieldValues | undefined) => HeldTransition,
  ): boolean {
    const state = this.store.snapshot();
    const shots = revise(state.shots);
    let audio = state.audio;
    for (const layerId of layerIds) {
      if (state.shots.findLayer(layerId) === null) continue;
      audio = this.withSound(audio, layerId, edge, heldOf(state.shots.layerStyles.get(layerId)?.fields), kind);
    }
    if (shots === state.shots && audio === state.audio) return false;
    this.store.commit(kind === 'cut' ? 'Remove transition' : 'Change transition');
    this.store.patch({ shots, audio });
    return true;
  }

  private withSound(
    audio: AudioMix,
    layerId: string,
    edge: LayerTransitionEdge,
    held: HeldTransition,
    kind: LayerTransitionKind | 'cut',
  ): AudioMix {
    if (kind === held.kind) return audio;
    if (kind === 'cut') return audio.withoutClips(this.suggestions.clipsOn(audio, layerId, edge).map((clip) => clip.id));
    const heldSound = held.kind === 'cut' ? null : this.suggestions.clipIn(audio, layerId, edge, held.kind);
    const keepsSound = held.kind === 'cut' || !held.picked || heldSound !== null;
    const without = heldSound === null ? audio : audio.withoutClips([heldSound.id]);
    if (!keepsSound) return without;
    return without.withClipAdded(this.defaults.clipFrom(crypto.randomUUID(), this.suggestions.draftFor(layerId, edge, kind)));
  }
}
