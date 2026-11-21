import { memo, useMemo } from 'react';
import { Ban } from 'lucide-react';
import type { SplitTransitionEdge } from '@core/elements/domain/fields/SplitTransitionField';
import type { ShotLayerSplitTransitionKind } from '@core/shots/domain/ShotLayerSplitTransitions';
import type { ShotLayerSplitTransitionForm } from '@presentation/shots/services/ShotLayerSplitTransitionForm';
import { MixedValueMarker } from '@ui/_shared/components/controls/fields/MixedValueMarker';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { AnimationCardGrid } from '@ui/_shared/components/element-fields/AnimationCardGrid';
import { ElementAnimationCard } from '@ui/_shared/components/element-fields/ElementAnimationCard';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { SplitTransitionIcon } from '@ui/pages/editor/features/shots/components/SplitTransitionIcon';
import { FIELD_ROW_CLASS, FIELD_ROWS_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';
import { ShotLayerTransitionSoundRow } from '@ui/pages/editor/features/shots/components/ShotLayerTransitionSoundRow';

interface ShotLayerSplitTransitionSectionProps {
  form: ShotLayerSplitTransitionForm;
  /** One layer, or several edited together, every one splitting the frame. Never empty. */
  layerIds: readonly string[];
  edge: SplitTransitionEdge;
  /** Plays the first layer's end being edited, so a transition picked is watched. */
  onReplay: () => void;
}

const GLYPH_SIZE = 22;
const ICON_SIZE = 48;

/**
 * How the line dividing a split frame moves at one end of the layers:
 * cards in the motion cards' language, *None* first, and how long the
 * line takes where it moves. A card picked plays that end again; every
 * change reaches all the layers in one undo step, *Mixed* where they
 * differ.
 */
export const ShotLayerSplitTransitionSection = memo(function ShotLayerSplitTransitionSection({
  form,
  layerIds,
  edge,
  onReplay,
}: ShotLayerSplitTransitionSectionProps) {
  const { actions, services } = useShots();
  const { layerStyles } = useEditorState().shots;
  const duration = useElements().services.styledElementCatalog.requireControl('layer', services.splitTransitions.durationFieldOf(edge));
  const view = useMemo(
    () => form.viewOf(layerIds.map((layerId) => layerStyles.get(layerId)?.fields), edge),
    [form, layerIds, layerStyles, edge],
  );
  const pick = (kind: ShotLayerSplitTransitionKind) => {
    actions.setLayerTransition.pickSplit(layerIds, edge, kind);
    onReplay();
  };

  return (
    <Section title="Split line">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {view.isKindMixed && <MixedValueMarker inline />}
          <AnimationCardGrid label="Split line">
            {form.options().map((option) => (
              <ElementAnimationCard
                key={option.value}
                label={option.label}
                selected={view.kind === option.value}
                icon={option.value === 'cut'
                  ? <Ban size={GLYPH_SIZE} strokeWidth={1.5} />
                  : <SplitTransitionIcon kind={option.value} edge={edge} size={ICON_SIZE} />}
                onSelect={() => pick(option.value)}
              />
            ))}
          </AnimationCardGrid>
        </div>
        {view.kind !== 'cut' && (
          <div className={FIELD_ROWS_CLASS}>
            <div className={FIELD_ROW_CLASS}>
              <Slider
                label="Duration"
                mixed={view.isDurationMixed}
                value={view.durationSec}
                min={duration.min ?? 0}
                max={duration.max ?? 1}
                step={duration.step ?? 0.05}
                unit={duration.unit}
                onChange={(seconds) => actions.setLayerSplitTransition.setDurationSec(layerIds, edge, seconds)}
              />
            </div>
            <ShotLayerTransitionSoundRow layerIds={layerIds} edge={edge} />
          </div>
        )}
      </div>
    </Section>
  );
});
