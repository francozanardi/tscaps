import { useCallback, useMemo } from 'react';
import type { AudioEffectRow } from '@presentation/audio-mix/services/AudioTabPresenter';
import { SoundOriginDestinations, type SoundOriginDestination, type SoundPageOwner } from '@presentation/audio-mix/services/SoundOriginDestinations';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';
import { useOverlaySelectionController } from '@ui/pages/editor/contexts/OverlaySelectionContext';
import { useEditorWorkspaceStore } from '@ui/pages/editor/contexts/EditorWorkspaceContext';
import { useElementInspectorTabNav } from '@ui/pages/editor/features/element/ElementInspectorTabNavContext';
import type { SoundEffectGoTo } from '@ui/pages/editor/features/audio/components/SoundEffectRow';
import { soundSpotlightKey } from '@ui/pages/editor/features/audio/soundSpotlightKey';
import { TRANSITION_SOUND_SPOTLIGHT } from '@ui/pages/editor/features/shots/components/ShotLayerTransitionSoundRow';

/**
 * For `owner`'s sound page: the button that takes a sound played by
 * something else to where that is changed — another tab of the same
 * inspector, another element's inspector opened on that page, the
 * transition beside its shot — with the sound scrolled into view and
 * lit; null where there is nowhere to go.
 */
export function useSoundOriginGoTo(owner: SoundPageOwner): (row: AudioEffectRow) => SoundEffectGoTo | null {
  const destinations = useMemo(() => new SoundOriginDestinations(), []);
  const nav = useElementInspectorTabNav();
  const workspace = useEditorWorkspaceStore();
  const selection = useOverlaySelectionController();
  const store = useEditorStore();

  const go = useCallback((destination: SoundOriginDestination, clipId: string) => {
    // A layer's transition is lit as the rows of its end; any other sound, as its own row.
    const spotlight = 'transitionEdge' in destination && destination.transitionEdge !== null
      ? TRANSITION_SOUND_SPOTLIGHT[destination.transitionEdge]
      : soundSpotlightKey(clipId);
    switch (destination.kind) {
      case 'tab':
        nav.show(destination.page, spotlight);
        return;
      case 'layer':
        workspace.requestInspectorPage(destination.page, spotlight);
        selection.pickShotLayer(destination.layerId);
        return;
      case 'word': {
        // Read when pressed: the word's scene is the one the document holds now.
        const segment = store.snapshot().document?.getSegments()
          .find((candidate) => candidate.getWords().some((word) => word.id === destination.wordId));
        if (segment === undefined) return;
        workspace.requestInspectorPage('sound', spotlight);
        selection.pickCaption(segment.id, destination.wordId);
        return;
      }
      case 'shot-transition':
        // The transition opens beside the shot in the Video mode, which the inspector stands in front of.
        selection.clearSelection();
        workspace.requestShotTransition(destination.shotId, spotlight);
    }
  }, [nav, workspace, selection, store]);

  return useCallback((row: AudioEffectRow) => {
    const destination = destinations.destinationOf(row.clip.start.anchor, owner);
    return destination === null ? null : { label: destination.label, onGo: () => go(destination, row.clip.id) };
  }, [destinations, owner, go]);
}
