import { memo, useMemo } from 'react';
import { Ban, CornerDownRight } from 'lucide-react';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import { AnimationCardGrid } from '@ui/_shared/components/element-fields/AnimationCardGrid';
import { ElementAnimationCard } from '@ui/_shared/components/element-fields/ElementAnimationCard';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';

interface ElementAnimationGridProps {
  /**
   * The kind of element this part answers for. An entrance the library
   * wrote for one kind is offered there and nowhere else, so the grid
   * has to know which one it is showing.
   */
  animatedKind: ElementKind;
  /** Which part, at which end of its life: an entrance and an exit are offered different motions. */
  scope: ElementAnimationScope;
  /** What this part was told to do, or `undefined` for whatever reaches it. */
  animation: ElementAnimation | undefined;
  /** What the answer nobody gave is called here: an ancestor's, or the template's. */
  inheritedLabel: string;
  /**
   * The card the unanswered state already is: an entrance's id, or
   * `null` for not moving — the same vocabulary a given answer uses.
   * That card takes the selection and the inherited card goes away,
   * since naming the movement beats naming where it came from.
   *
   * Left out where the answer cannot be named, and where naming it
   * would not help: an element inherits from an ancestor it can go and
   * edit, so the inherited card there says the one thing that matters —
   * this part was not told anything.
   */
  inheritedPresetId?: string | null | undefined;
  onInherit: () => void;
  onDisable: () => void;
  onPick: (presetId: string) => void;
}

const GLYPH_SIZE = 22;

/** Turns an animation's id into the name it goes by: `slide-in` reads as "Slide in". */
function labelFor(presetId: string): string {
  const words = presetId.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Every answer one part of an element can be given, as one grid.
 *
 * The answers that are not animations lead it: nothing recorded, and
 * told not to move. They sit in the same grid and take the same
 * selection, because they answer the same question — split into a
 * control of their own they would read as a second setting the grid
 * then has to agree with. They carry a line glyph rather than a drawn
 * shape, so a reader can tell at a glance which cards are looks and
 * which are states.
 *
 * "Nothing recorded" drops out where the caller can say which entrance
 * that already is: two cards would then be selected for one state, and
 * the one naming the movement is the useful one.
 *
 * An entrance's picture is authored beside the animation and compiled
 * into the library, so the markup here is ours rather than anything a
 * user or a template can reach.
 */
export const ElementAnimationGrid = memo(function ElementAnimationGrid({
  animatedKind,
  scope,
  animation,
  inheritedLabel,
  inheritedPresetId,
  onInherit,
  onDisable,
  onPick,
}: ElementAnimationGridProps) {
  const { animationCatalog, timingVariableResolver } = useElements().services;
  const presets = useMemo(
    () => animationCatalog.forClock(animatedKind, timingVariableResolver.resolve(animatedKind, scope)),
    [animationCatalog, timingVariableResolver, animatedKind, scope],
  );

  // Whether the grid can name the unanswered state is a fact about the
  // grid, not about what is answered right now: a card that appeared on
  // picking something else would be offering a state the grid was
  // already able to express.
  const named = inheritedPresetId !== undefined;
  const unanswered = animation === undefined;
  const selectedPresetId = unanswered ? (named ? inheritedPresetId : undefined) : animation.presetId;

  return (
    <AnimationCardGrid label="Animation">
      {!named && (
        <ElementAnimationCard
          label={inheritedLabel}
          selected={unanswered}
          icon={<CornerDownRight size={GLYPH_SIZE} strokeWidth={1.5} />}
          onSelect={onInherit}
        />
      )}
      <ElementAnimationCard
        label="None"
        selected={selectedPresetId === null}
        icon={<Ban size={GLYPH_SIZE} strokeWidth={1.5} />}
        onSelect={onDisable}
      />
      {presets.map((preset) => (
        <ElementAnimationCard
          key={preset.id}
          label={labelFor(preset.id)}
          selected={selectedPresetId === preset.id}
          icon={<span dangerouslySetInnerHTML={{ __html: preset.icon }} />}
          onSelect={() => onPick(preset.id)}
        />
      ))}
    </AnimationCardGrid>
  );
});
