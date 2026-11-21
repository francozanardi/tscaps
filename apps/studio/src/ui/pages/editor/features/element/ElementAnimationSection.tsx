import { memo, useCallback } from 'react';
import {
  ANIMATED_KIND_BY_SCOPE,
  ANIMATION_PHASE_BY_SCOPE,
  type ElementAnimationScope,
} from '@core/elements/domain/ElementAnimationScope';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import { UNSUPPORTED_ANIMATION_MESSAGE } from '@ui/_shared/components/element-fields/ElementKindLabels';
import { ElementFieldControl } from '@ui/_shared/components/element-fields/ElementFieldControl';
import { CustomizedFieldOverlay } from '@ui/_shared/components/controls/fields/CustomizedFieldOverlay';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { ElementAnimationGrid } from '@ui/_shared/components/element-fields/ElementAnimationGrid';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useElementScripts } from '@ui/_shared/hooks/useElementScripts';

// Names what the grid holds rather than what it does to it: the strip
// above already says which end of the element's life it answers.
const SECTION_TITLE = 'Animation';
// Played before an exit starts, so it is seen to leave from rest.
const EXIT_REPLAY_LEAD_SEC = 0.3;

interface ElementAnimationSectionProps {
  elementId: string;
  kind: ElementKind;
  scope: ElementAnimationScope;
  /** Whether the sheet's template survives an animation landing where this panel would put one. */
  supported: boolean;
  style: ElementStyle | null;
  /** The stretch of video the element occupies, which is what a replay of its entrance plays. */
  startsAt: number;
  endsAt: number;
  /** The moment the element leaves the frame, which is where a replay of its exit ends. */
  leavesAt: number;
  /** Plays one stretch of the video once, kept inside the scene however far it is asked to reach. */
  onReplay: (startSec: number, endSec: number) => void;
}

/**
 * How one part of the element moves at one end of its life: the answers
 * it can be given, and the fields of whatever was picked.
 *
 * What was picked is recorded, and the block it writes goes into the
 * element's own CSS, so this shows what the user chose rather than what
 * a stylesheet can be read to mean. An animation written by hand is not
 * among the answers and does not need to be: whatever comes after wins
 * on its own.
 *
 * Once that block stops being the one this wrote, the section gives up.
 * An animation is a set of declarations plus its keyframes, so there is
 * no one line to overwrite, and picking again could only add a second
 * animation beside the one somebody wrote. The element's other parts
 * and its other end are unaffected: each block is found on its own.
 *
 * Picking one plays the element's own stretch of video — the start of
 * it for an entrance, the end of it for an exit — because that is the
 * only place the motion can actually be seen: the library travels in
 * `em` against caption text, so at the size of a card it is a pixel or
 * two. Picking the one already chosen plays it again and changes nothing
 * else, which is what lets a value be tuned and watched.
 */
export const ElementAnimationSection = memo(function ElementAnimationSection({
  elementId,
  kind,
  scope,
  supported,
  style,
  startsAt,
  endsAt,
  leavesAt,
  onReplay,
}: ElementAnimationSectionProps) {
  const elements = useElements();
  const { animationCatalog, animationCssWriter } = elements.services;
  // No sheet in scope to settle Arabic against Urdu, and no motion control
  // is a font control, so the alphabets only ever reach an unused prop.
  const scripts = useElementScripts(elementId, null);

  const leaving = ANIMATION_PHASE_BY_SCOPE[scope] === 'exit';
  const animatedKind = ANIMATED_KIND_BY_SCOPE[scope] ?? kind;
  const animation = style?.animations?.[scope];
  const preset = animation?.presetId ? animationCatalog.byId(animation.presetId) : null;
  const controlledByCss = animation !== undefined
    && animationCssWriter.isTakenOver(style?.css ?? '', kind, scope, animation);

  const replay = useCallback(() => {
    const seconds = secondsOf(preset, animation);
    if (leaving) onReplay(Math.max(startsAt, leavesAt - seconds - EXIT_REPLAY_LEAD_SEC), leavesAt);
    else onReplay(startsAt, Math.max(endsAt, startsAt + seconds));
  }, [onReplay, leaving, startsAt, endsAt, leavesAt, preset, animation]);

  const actions = elements.actions.setAnimation;
  const handleInherit = useCallback(() => {
    actions.clear(elementId, kind, scope);
    replay();
  }, [actions, elementId, kind, scope, replay]);
  const handleDisable = useCallback(() => {
    actions.disable(elementId, kind, scope);
    replay();
  }, [actions, elementId, kind, scope, replay]);
  const handlePick = useCallback((presetId: string) => {
    actions.apply(elementId, kind, scope, presetId);
    replay();
  }, [actions, elementId, kind, scope, replay]);
  const handleControlChange = useCallback(
    (control: AuthoredElementControl, next: ElementControlValue) =>
      actions.setControl(elementId, kind, scope, control, next),
    [actions, elementId, kind, scope],
  );

  return (
    <Section
      disabled={!supported}
      disabledMessage={UNSUPPORTED_ANIMATION_MESSAGE}
    >
      <CustomizedFieldOverlay customized={controlledByCss} label={SECTION_TITLE}>
        <div className="flex flex-col gap-5">
          <ElementAnimationGrid
            animatedKind={animatedKind}
            scope={scope}
            animation={animation}
            inheritedLabel="Inherited"
            onInherit={handleInherit}
            onDisable={handleDisable}
            onPick={handlePick}
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
        </div>
      </CustomizedFieldOverlay>
    </Section>
  );
});

/**
 * How long the animation runs, so a stretch shorter than it still plays
 * the whole motion. Read off the field in seconds rather than the
 * field's name: the property is the library's API and the name is not.
 */
function secondsOf(preset: ElementAnimationPreset | null, animation: ElementAnimation | undefined): number {
  const control = preset?.controls.find((candidate) => candidate.unit === 's');
  if (!control) return 0;
  const held = animation?.params[control.id] ?? control.defaultValue;
  return typeof held === 'number' ? held : 0;
}
