import { useMemo } from 'react';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import { useSpotlightTarget } from '@ui/pages/editor/features/element/useSpotlightTarget';
import { ShotLayerSoundFields } from '@ui/pages/editor/features/shots/components/ShotLayerSoundFields';
import { FIELD_ROWS_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';

interface ShotLayerTransitionSoundRowProps {
  /** One layer, or several edited together. Never empty. */
  layerIds: readonly string[];
  edge: 'entrance' | 'exit';
}

/** The key the Sound tab points to a transition's sound under, at each end. */
export const TRANSITION_SOUND_SPOTLIGHT: Readonly<Record<'entrance' | 'exit', string>> = {
  entrance: 'layer-transition-sound:entrance',
  exit: 'layer-transition-sound:exit',
};

// Room around the rows for the spotlight's band, without moving them: as far as the page scrolls on either side.
const SPOTLIGHT_ROOM_CLASS = '-mx-2 px-2 -my-2 py-2';

/**
 * The sound a layer's layout transition plays at one end (a split's
 * line, a box from or to the whole frame), beside the transition it
 * belongs to, in the same rows a layer's entry and exit sounds use:
 * without the offset, since it lands on the transition's middle, which
 * follows its length. Lit when the Sound tab points here.
 */
export function ShotLayerTransitionSoundRow({ layerIds, edge }: ShotLayerTransitionSoundRowProps) {
  const { projectId } = useEditorState();
  const presenter = useAnchoredSoundsPresenter();
  const anchors = useMemo(() => layerIds.map((layerId) => presenter.layerTransitionAnchor(layerId, edge)), [presenter, layerIds, edge]);
  const spotlight = useSpotlightTarget<HTMLDivElement>(TRANSITION_SOUND_SPOTLIGHT[edge]);
  return (
    <div ref={spotlight} className={`${FIELD_ROWS_CLASS} ${SPOTLIGHT_ROOM_CLASS}`}>
      <ShotLayerSoundFields anchors={anchors} offsets={false} projectId={projectId} />
    </div>
  );
}
