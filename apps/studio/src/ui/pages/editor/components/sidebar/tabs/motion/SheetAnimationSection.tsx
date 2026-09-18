import { memo } from 'react';
import { ANIMATED_KIND_BY_SCOPE, type ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { SheetAnimationSet } from '@core/sheets/domain/SheetAnimationSet';
import type { StyleValues } from '@core/sheets/domain/StyleValues';
import { MOTION_SUBGROUP_BY_SCOPE, type ControlField, type ControlValue } from '@core/templates/domain/definition/ControlField';
import type { AnimationSupport } from '@core/templates/domain/definition/FeaturesConfig';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';
import { UNSUPPORTED_ANIMATION_MESSAGE } from '@ui/_shared/components/element-fields/ElementKindLabels';
import { ElementAnimationGrid } from '@ui/_shared/components/element-fields/ElementAnimationGrid';
import { ElementFieldControl } from '@ui/_shared/components/element-fields/ElementFieldControl';
import { FieldView } from '@ui/_shared/components/controls/fields/FieldView';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import type { FontFaceSlot } from '@core/fonts/domain/FontScript';

interface SheetAnimationSectionProps {
  scope: ElementAnimationScope;
  animations: SheetAnimationSet;
  /** What the sheet's template moves on its own, which is what the Template card offers dials over. */
  declaredAnimations: ReadonlyArray<DeclaredAnimation>;
  /** Every control the template publishes, of which the ones grouped under this scope are shown. */
  styleControls: readonly ControlField[];
  /** Which kinds of element the template's look survives being animated. */
  animationSupport: AnimationSupport;
  styleValues: StyleValues;
  /** Ids whose variable the sheet's own CSS no longer reads. */
  customizedIds: ReadonlySet<string>;
  /** Alphabets the sheet's captions are written in, the most used first. */
  scripts: ReadonlyArray<FontFaceSlot>;
  /** Plays the caption on screen once, so the motion can be seen where it renders. */
  onReplay: () => void;
}

/**
 * How one kind of element moves everywhere this sheet paints: the
 * answers it can be given, and the fields of whichever is standing.
 *
 * **The template's answer has fields too.** Leaving a kind to the
 * template is not leaving it alone — the template moves it, and the
 * dials over that movement are the ones its own animation declares,
 * starting on the values the template wrote. So the card that means
 * "as the template has it" opens the same kind of panel a picked
 * animation does, and the two never show at once because a kind holds
 * one answer.
 *
 * A template offers no dial where it gave a property two answers, or
 * routed it through a variable of its own. The animation runs either
 * way; only the dial cannot open, which is why nothing is drawn in its
 * place.
 *
 * **A template that writes its own keyframes publishes its own
 * controls**, grouped under the kind they move. Those are ordinary
 * style controls and go on behaving like ones — the sheet stores them
 * beside every other value it was given, and the Style tab leaves them
 * to this panel rather than showing them twice. They go away with the
 * rest the moment the animation is replaced: a sheet's answer takes
 * over the template's, so a dial still sitting there over movement that
 * has been replaced would be describing something nobody can see.
 *
 * **The template's card only appears where the picker cannot name what
 * the template does.** A sheet is not an element with a parent to defer
 * to — nothing is above it — so "as the template has it" is a fact
 * about this panel: where that fact is `rise-in` the panel shows
 * `rise-in`, and where the template moves this kind with nothing it
 * shows None. Reset is what puts a kind back, which is why it is a
 * button beside the strip rather than a card.
 *
 * Picking the card already showing changes nothing and still replays.
 * Watching the motion again is most of why anyone clicks a card they
 * already have, and applying it would move the caption: over the
 * template's own it swaps the template's parameters for the library's.
 *
 * Nothing asks whether the CSS was taken over. A sheet's blocks live in
 * a layer of their own rather than mixed into the text the code editor
 * edits, so the two can never be the same declarations — what is
 * written here simply outranks the template, and a hand-written rule
 * that wants to win says `!important`, which reverses the layer order.
 */
export const SheetAnimationSection = memo(function SheetAnimationSection({
  scope,
  animations,
  declaredAnimations,
  styleControls,
  animationSupport,
  styleValues,
  customizedIds,
  scripts,
  onReplay,
}: SheetAnimationSectionProps) {
  const { animationCatalog, templateAnimationFields, templateAnimationAnswer, animationSupport: support } = useElements().services;
  const { setAnimation, tuneAnimation, updateControl } = useSheets().actions.style;

  const answered = animations.get(scope);
  const animation = answered?.kind === 'replaced' ? answered.animation : undefined;
  const preset = animation?.presetId ? animationCatalog.byId(animation.presetId) : null;
  const onTemplates = animation === undefined;
  const byTemplate = templateAnimationAnswer.answerFor(declaredAnimations, scope);
  const inheritedPresetId = byTemplate.kind === 'entrance'
    ? byTemplate.presetId
    : byTemplate.kind === 'still' ? null : undefined;
  const showing = onTemplates ? inheritedPresetId : animation.presetId;
  const templateFields = onTemplates
    ? templateAnimationFields.fieldsFor(declaredAnimations, scope, answered?.kind === 'tuned' ? answered.values : {})
    : [];
  const subgroup = MOTION_SUBGROUP_BY_SCOPE[scope];
  const publishedControls = onTemplates
    ? styleControls.filter((control) => control.group === 'motion' && control.subgroup === subgroup)
    : [];

  /**
   * Picking the card already showing is not a change, and applying it
   * would be one: over the template's own it would swap the template's
   * parameters for the library's shipped ones and move the caption.
   * The replay still runs — watching it again is most of why anyone
   * clicks a card they already have.
   *
   * Picking the card the template itself is takes the sheet's answer
   * back rather than restating it. The two render the same movement,
   * and only one of them keeps the values the template chose.
   */
  const pick = (presetId: string | null) => {
    if (presetId === showing) onReplay();
    else if (presetId === inheritedPresetId) handleInherit();
    else if (presetId === null) handleDisable();
    else handleApply(presetId);
  };
  const handleInherit = () => {
    setAnimation.clear(scope);
    onReplay();
  };
  const handleDisable = () => {
    setAnimation.disable(scope);
    onReplay();
  };
  const handleApply = (presetId: string) => {
    setAnimation.apply(scope, presetId);
    onReplay();
  };
  const handleControlChange = (control: AuthoredElementControl, next: ElementControlValue) =>
    setAnimation.setControl(scope, control, next);

  // Every scope a sheet answers names a kind — it is not a rendered
  // element, so `self` would have nothing to land on.
  const animatedKind = ANIMATED_KIND_BY_SCOPE[scope];
  const supported = support.supports(animationSupport, scope, null);

  if (animatedKind === null) return null;

  return (
    <Section disabled={!supported} disabledMessage={UNSUPPORTED_ANIMATION_MESSAGE}>
      <div className="flex flex-col gap-5">
        <ElementAnimationGrid
          animatedKind={animatedKind}
          animation={animation}
          inheritedLabel="Template"
          inheritedPresetId={inheritedPresetId}
          onInherit={handleInherit}
          onDisable={() => pick(null)}
          onPick={pick}
        />
        {preset !== null && (
          <div className="flex flex-col gap-3">
            {preset.controls.map((control) => (
              <ElementFieldControl
                scripts={scripts}
                key={control.id}
                control={control}
                shown={animation?.params[control.id] ?? control.defaultValue}
                onChange={handleControlChange}
              />
            ))}
          </div>
        )}
        {templateFields.length > 0 && (
          <div className="flex flex-col gap-3">
            {templateFields.map(({ control, standing }) => (
              <ElementFieldControl
                scripts={scripts}
                key={`${control.property} ${control.part}`}
                control={control}
                shown={control.defaultValue}
                onChange={(moved, next) => tuneAnimation.setField(scope, moved, next, standing)}
              />
            ))}
          </div>
        )}
        {publishedControls.length > 0 && (
          <div className="flex flex-col gap-3">
            {publishedControls.map((control) => (
              <FieldView
                scripts={scripts}
                key={control.id}
                field={control}
                value={styleValues.values[control.id] ?? control.default}
                customized={customizedIds.has(control.id)}
                onChange={(moved: ControlField, value: ControlValue) => updateControl.execute(moved, value)}
              />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
});
