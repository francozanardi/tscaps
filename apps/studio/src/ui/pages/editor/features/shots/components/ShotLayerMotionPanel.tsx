import { memo, useCallback, useMemo, useState } from 'react';
import { Ban } from 'lucide-react';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { ShotLayerAnimationScope } from '@core/shots/actions/SetShotLayerAnimationAction';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import { ElementAnimationScope, type ElementAnimationPhase } from '@core/elements/domain/ElementAnimationScope';
import type { ShotLayerMotionForm } from '@presentation/shots/services/ShotLayerMotionForm';
import { MotionPanelFrame } from '@ui/_shared/components/element-fields/MotionPanelFrame';
import { MixedValueMarker } from '@ui/_shared/components/controls/fields/MixedValueMarker';
import { CustomizedFieldOverlay } from '@ui/_shared/components/controls/fields/CustomizedFieldOverlay';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { AnimationCardGrid } from '@ui/_shared/components/element-fields/AnimationCardGrid';
import { ElementAnimationCard } from '@ui/_shared/components/element-fields/ElementAnimationCard';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useSpotlightRequest } from '@ui/pages/editor/features/element/SpotlightContext';
import { TRANSITION_SOUND_SPOTLIGHT } from '@ui/pages/editor/features/shots/components/ShotLayerTransitionSoundRow';
import { ShotLayerMotionFieldControl } from '@ui/pages/editor/features/shots/components/ShotLayerMotionFieldControl';
import { ShotLayerSplitTransitionSection } from '@ui/pages/editor/features/shots/components/ShotLayerSplitTransitionSection';
import { ShotLayerInsetTransitionSection } from '@ui/pages/editor/features/shots/components/ShotLayerInsetTransitionSection';
import { useShotLayerInsetTransitionForm } from '@ui/pages/editor/features/shots/hooks/useShotLayerInsetTransitionForm';
import { useShotLayerMotionForm } from '@ui/pages/editor/features/shots/hooks/useShotLayerMotionForm';
import { useShotLayerReplay } from '@ui/pages/editor/features/shots/hooks/useShotLayerReplay';
import { useShotLayerSplitTransitionForm } from '@ui/pages/editor/features/shots/hooks/useShotLayerSplitTransitionForm';
import { useShotLayerTakeover } from '@ui/pages/editor/features/shots/hooks/useShotLayerTakeover';
import { FIELD_ROW_CLASS, FIELD_ROWS_CLASS } from '@ui/pages/editor/features/shots/shot-layer-field-classes';

/** A layer the Motion tab edits; a layer whose file is gone has no motion to give, and is never one. */
export interface ShotLayerMotionTarget {
  readonly layer: ShotLayer;
}

interface ShotLayerMotionPanelProps {
  /** One layer, or several edited together; the first is the one shown. Never empty. */
  targets: ReadonlyArray<ShotLayerMotionTarget>;
}

const GLYPH_SIZE = 22;

/**
 * How shot layers come onto the frame as their shot starts, leave as it
 * ends, one end at a time: the motions to pick from, and the picked
 * one's own fields. A pick is recorded in each layer's style and
 * written into its CSS, which is what the preview and the export play.
 *
 * Several layers show the first one's motion and say *Mixed* where the
 * rest differ. Picking a preset gives it to every layer, each keeping
 * the values it already had of the fields the two presets share; a
 * field changed reaches every layer whose preset holds it. One undo
 * step either way.
 *
 * An end the first layer's own CSS has taken over — its block written
 * over, or an `animation` of its own — is dimmed under the pill saying
 * so.
 *
 * Layers that all split the frame first say, in a section of its own,
 * how the line dividing the frame moves at that end; the layer's motion,
 * in the section below, plays inside its part as it grows.
 *
 * Picking a motion, or how the line moves, plays that end of the first
 * layer where it shows, for as long as it moves and a moment more, since
 * that is where it is really judged; picking the one already picked
 * plays it again and changes nothing else.
 *
 * How the two ends share a short shot is said under the picked motion's
 * fields, next to the duration it bounds; with no motion picked there
 * is nothing to share.
 */
export const ShotLayerMotionPanel = memo(function ShotLayerMotionPanel({ targets }: ShotLayerMotionPanelProps) {
  const form = useShotLayerMotionForm();
  const { key: spotlight } = useSpotlightRequest();
  // Which end is open is a view of the panel, not of the project. The
  // panel opens on the end another tab pointed to, where one did.
  const [open, setOpen] = useState<ElementAnimationPhase>(() => (
    spotlight === TRANSITION_SOUND_SPOTLIGHT.exit ? 'exit' : 'entrance'
  ));
  return (
    <MotionPanelFrame
      ends={LAYER_ENDS}
      end={open}
      onEndChange={setOpen}
      renderEnd={(end) => <ShotLayerMotionScopeSection form={form} targets={targets} scope={SCOPE_BY_END[end]} />}
    />
  );
});

// A layer comes in and leaves; what it does in between is its camera's, in a tab of its own.
const LAYER_ENDS: ReadonlyArray<ElementAnimationPhase> = ['entrance', 'exit'];
const SCOPE_BY_END: Readonly<Record<ElementAnimationPhase, ShotLayerAnimationScope>> = {
  entrance: ElementAnimationScope.ENTRANCE,
  exit: ElementAnimationScope.EXIT,
  camera: ElementAnimationScope.CAMERA,
};

interface ShotLayerMotionScopeSectionProps {
  form: ShotLayerMotionForm;
  targets: ReadonlyArray<ShotLayerMotionTarget>;
  scope: ShotLayerAnimationScope;
}

function ShotLayerMotionScopeSection({ form, targets, scope }: ShotLayerMotionScopeSectionProps) {
  const { actions } = useShots();
  const { shots } = useEditorState();
  const { layerStyles } = shots;
  const first = targets[0]!;
  const replay = useShotLayerReplay(first.layer.id);
  const layerIds = useMemo(() => targets.map((target) => target.layer.id), [targets]);
  const animations = useMemo(
    () => layerIds.map((layerId) => layerStyles.animationOf(layerId, scope) ?? undefined),
    [layerIds, layerStyles, scope],
  );
  const animation = animations[0];
  const picked = form.pickedPresetId(animation);
  const ownMotionNote = form.ownMotionNoteOf(targets.map((target) => target.layer));
  const presetMixed = form.isPresetMixed(animations);
  const mixedFieldIds = useMemo(() => form.mixedFieldIds(animations), [form, animations]);
  const takenByCss = useShotLayerTakeover(layerStyles.get(first.layer.id)).motion.has(scope);
  const splitForm = useShotLayerSplitTransitionForm();
  const layouts = layerIds.map((layerId) => shots.placementOf(layerId).kind);
  const splits = splitForm.isOffered(layouts);
  const insetForm = useShotLayerInsetTransitionForm();
  const insets = insetForm.isOffered(layouts);

  const replayThisEnd = useCallback(() => replay(scope), [replay, scope]);
  const handlePick = useCallback((presetId: string | null) => {
    actions.setLayerAnimation.pick(layerIds, scope, presetId);
    replayThisEnd();
  }, [actions, layerIds, scope, replayThisEnd]);
  const handleField = useCallback(
    (controlId: string, value: ElementControlValue) => actions.setLayerAnimation.setParam(layerIds, scope, controlId, value),
    [actions, layerIds, scope],
  );

  return (
    <>
      {splits && (
        <ShotLayerSplitTransitionSection
          form={splitForm}
          layerIds={layerIds}
          edge={scope === ElementAnimationScope.ENTRANCE ? 'entrance' : 'exit'}
          onReplay={replayThisEnd}
        />
      )}
      {insets && (
        <ShotLayerInsetTransitionSection
          form={insetForm}
          layerIds={layerIds}
          edge={scope === ElementAnimationScope.ENTRANCE ? 'entrance' : 'exit'}
          onReplay={replayThisEnd}
        />
      )}
      <Section title={splits || insets ? 'Layer motion' : undefined}>
        <CustomizedFieldOverlay customized={takenByCss} label={`${form.scopeTitle(scope)} motion`}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {presetMixed && <MixedValueMarker inline />}
              <AnimationCardGrid label={`${form.scopeTitle(scope)} motion`}>
                <ElementAnimationCard
                  label="None"
                  selected={picked === null}
                  icon={<Ban size={GLYPH_SIZE} strokeWidth={1.5} />}
                  onSelect={() => handlePick(null)}
                />
                {form.presets(scope).map((preset) => (
                  <ElementAnimationCard
                    key={preset.id}
                    label={form.labelOf(preset)}
                    selected={picked === preset.id}
                    icon={<span dangerouslySetInnerHTML={{ __html: preset.icon }} />}
                    onSelect={() => handlePick(preset.id)}
                  />
                ))}
              </AnimationCardGrid>
              {ownMotionNote !== null && <p className="m-0 text-2xs text-fg-faint leading-snug">{ownMotionNote}</p>}
            </div>
            {picked !== null && (
              <div className={FIELD_ROWS_CLASS}>
                {form.fieldsOf(animation).map((view) => (
                  <div key={view.control.id} className={FIELD_ROW_CLASS}>
                    <ShotLayerMotionFieldControl
                      form={form}
                      view={view}
                      mixed={mixedFieldIds.has(view.control.id)}
                      onChange={handleField}
                    />
                  </div>
                ))}
                <p className="m-0 pt-1 text-2xs text-fg-faint leading-snug">
                  On a shot too short for both, the entrance and the exit each take at most half of it, so they never overlap.
                </p>
              </div>
            )}
          </div>
        </CustomizedFieldOverlay>
      </Section>
    </>
  );
}
