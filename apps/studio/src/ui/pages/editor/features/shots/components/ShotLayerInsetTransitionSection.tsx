import { memo, useMemo } from 'react';
import { Ban } from 'lucide-react';
import type { InsetTransitionEdge } from '@core/elements/domain/fields/InsetTransitionField';
import type { ShotLayerInsetTransitionKind } from '@core/shots/domain/ShotLayerInsetTransitions';
import type { ShotLayerInsetTransitionForm } from '@presentation/shots/services/ShotLayerInsetTransitionForm';
import { MixedValueMarker } from '@ui/_shared/components/controls/fields/MixedValueMarker';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { AnimationCardGrid } from '@ui/_shared/components/element-fields/AnimationCardGrid';
import { ElementAnimationCard } from '@ui/_shared/components/element-fields/ElementAnimationCard';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { InsetTransitionIcon } from '@ui/pages/editor/features/shots/components/InsetTransitionIcon';
import { FIELD_ROW_CLASS, FIELD_ROWS_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';
import { ShotLayerTransitionSoundRow } from '@ui/pages/editor/features/shots/components/ShotLayerTransitionSoundRow';

interface ShotLayerInsetTransitionSectionProps {
  form: ShotLayerInsetTransitionForm;
  /** One layer, or several edited together, every one a box. Never empty. */
  layerIds: readonly string[];
  edge: InsetTransitionEdge;
  /** Plays the first layer's end being edited, so a transition picked is watched. */
  onReplay: () => void;
}

const GLYPH_SIZE = 22;
const ICON_SIZE = 48;

/**
 * How what floats in a picture-in-picture box comes in, or leaves, at
 * one end of the layers: cards in the motion cards' language, *None*
 * first, and how long it takes. A card picked plays that end again;
 * every change reaches all the layers in one undo step, *Mixed* where
 * they differ.
 */
export const ShotLayerInsetTransitionSection = memo(function ShotLayerInsetTransitionSection({
  form,
  layerIds,
  edge,
  onReplay,
}: ShotLayerInsetTransitionSectionProps) {
  const { actions, services } = useShots();
  const { layerStyles } = useEditorState().shots;
  const duration = useElements().services.styledElementCatalog.requireControl('layer', services.insetTransitions.durationFieldOf(edge));
  const view = useMemo(
    () => form.viewOf(layerIds.map((layerId) => layerStyles.get(layerId)?.fields), edge),
    [form, layerIds, layerStyles, edge],
  );
  const pick = (kind: ShotLayerInsetTransitionKind) => {
    actions.setLayerTransition.pickInset(layerIds, edge, kind);
    onReplay();
  };

  return (
    <Section title="Picture in picture">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {view.isKindMixed && <MixedValueMarker inline />}
          <AnimationCardGrid label="Picture in picture">
            {form.options(edge).map((option) => (
              <ElementAnimationCard
                key={option.value}
                label={option.label}
                selected={view.kind === option.value}
                icon={option.value === 'cut'
                  ? <Ban size={GLYPH_SIZE} strokeWidth={1.5} />
                  : <InsetTransitionIcon edge={edge} size={ICON_SIZE} />}
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
                onChange={(seconds) => actions.setLayerInsetTransition.setDurationSec(layerIds, edge, seconds)}
              />
            </div>
            <ShotLayerTransitionSoundRow layerIds={layerIds} edge={edge} />
          </div>
        )}
      </div>
    </Section>
  );
});
