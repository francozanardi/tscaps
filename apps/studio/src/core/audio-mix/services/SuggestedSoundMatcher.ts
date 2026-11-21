import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioClipDraft } from '@core/audio-mix/domain/AudioClipDraft';
import type { EditorState } from '@core/editor/domain/EditorState';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { LayerTransitionEdge, LayerTransitionKind, LayerTransitionSoundSuggestions } from '@core/shot-transitions/domain/LayerTransitionSoundSuggestions';
import type { ShotTransitionSoundSuggestions } from '@core/shot-transitions/domain/ShotTransitionSoundSuggestions';
import type { ShotCameraSounds } from '@core/shots/domain/ShotCameraSounds';
import type { ShotCameraTarget } from '@core/shots/domain/ShotCameraTarget';
import type { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import type { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';

/**
 * Tells whether a clip is the sound the editor suggests for what it is
 * anchored to: the transition into a shot, a camera move, or a layer's
 * transition at one edge, as that thing is set in `state` now. Only a
 * bundled sound can be one; a clip anchored anywhere else never is.
 */
export class SuggestedSoundMatcher {
  constructor(
    private readonly transitionSounds: ShotTransitionSoundSuggestions,
    private readonly cameraSounds: ShotCameraSounds,
    private readonly layerTransitionSounds: LayerTransitionSoundSuggestions,
    private readonly splitTransitions: ShotLayerSplitTransitions,
    private readonly insetTransitions: ShotLayerInsetTransitions,
  ) {}

  isSuggested(state: EditorState, clip: AudioClip): boolean {
    if (clip.source.kind !== 'builtin') return false;
    const suggested = this.suggestionFor(state, clip);
    return suggested?.source.kind === 'builtin' && suggested.source.soundId === clip.source.soundId;
  }

  private suggestionFor(state: EditorState, clip: AudioClip): AudioClipDraft | null {
    const anchor = clip.start.anchor;
    switch (anchor.kind) {
      case 'transition': {
        const kind = state.shots.list().find((shot) => shot.id === anchor.shotId)?.transition?.kind;
        return kind === undefined ? null : this.transitionSounds.draftFor(anchor.shotId, kind);
      }
      case 'camera':
        return this.cameraSuggestion(state, ShotVideoLayerId.of(anchor.shotId), { kind: 'shot', shotId: anchor.shotId });
      case 'layer-camera':
        return this.cameraSuggestion(state, anchor.layerId, { kind: 'layer', layerId: anchor.layerId });
      case 'layer-transition': {
        const kind = this.layerTransitionKindOf(state, anchor.layerId, anchor.edge);
        return kind === null ? null : this.layerTransitionSounds.draftFor(anchor.layerId, anchor.edge, kind);
      }
      default:
        return null;
    }
  }

  private cameraSuggestion(state: EditorState, styleId: string, target: ShotCameraTarget): AudioClipDraft | null {
    const presetId = state.shots.layerStyles.animationOf(styleId, ElementAnimationScope.CAMERA)?.presetId ?? null;
    return presetId === null ? null : this.cameraSounds.draftFor(target, presetId, null);
  }

  /** The transition the layer's layout plays at `edge`, as a sound is suggested for it; null where it plays none. */
  private layerTransitionKindOf(state: EditorState, layerId: string, edge: LayerTransitionEdge): LayerTransitionKind | null {
    const layout = state.shots.placementOf(layerId).kind;
    const fields = state.shots.layerStyles.get(layerId)?.fields;
    if (layout === 'split') {
      const kind = this.splitTransitions.kindOf(fields, edge);
      return kind === 'cut' ? null : kind;
    }
    if (layout === 'inset') return this.insetTransitions.kindOf(fields, edge) === 'full' ? 'full' : null;
    return null;
  }
}
