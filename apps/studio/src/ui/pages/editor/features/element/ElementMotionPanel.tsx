import { memo, useCallback, useMemo, useState } from 'react';
import type { ElementAnimationPhase } from '@core/elements/domain/ElementAnimationScope';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { AnimationSupport } from '@core/templates/domain/definition/FeaturesConfig';
import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import { MotionScopeLayout, type MotionPart } from '@presentation/editor/services/MotionScopeLayout';
import { ANIMATED_PART_LABELS, ELEMENT_KIND_LABELS } from '@ui/_shared/components/element-fields/ElementKindLabels';
import { MotionPanelFrame, type MotionPartOption } from '@ui/_shared/components/element-fields/MotionPanelFrame';
import { ElementAnimationSection } from '@ui/pages/editor/features/element/ElementAnimationSection';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';

interface ElementMotionPanelProps {
  elementId: string;
  kind: ElementKind;
  /** Which kinds of element the sheet's template survives being animated, or `null` when it has no sheet. */
  animationSupport: AnimationSupport | null;
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
 * How the element moves: as it comes in and as it leaves, one part of
 * it at a time.
 *
 * An element that wraps words offers more than itself, because "the
 * caption slides in" and "its words rise one by one" are different
 * answers, and a user who wants the second should not have to give it
 * once per word nor lose it the moment a word is added. Which end and
 * which part are read one at a time rather than stacked: each is a full
 * grid, and two of those is a page of scrolling to compare answers that
 * are never compared.
 */
export const ElementMotionPanel = memo(function ElementMotionPanel({
  elementId,
  kind,
  animationSupport,
  style,
  startsAt,
  endsAt,
  leavesAt,
  onReplay,
}: ElementMotionPanelProps) {
  const { styledElementCatalog, animationSupport: support } = useElements().services;
  const layout = useMemo(() => new MotionScopeLayout(styledElementCatalog.animationScopesFor(kind)), [styledElementCatalog, kind]);
  const ends = layout.ends();
  const parts = useMemo<ReadonlyArray<MotionPartOption>>(
    () => layout.parts().map((part) => ({ value: part, label: part === 'self' ? ELEMENT_KIND_LABELS[kind] : ANIMATED_PART_LABELS[part] })),
    [layout, kind],
  );

  // Which end and part are open is a view of the panel, remembered
  // across elements. Every kind moves itself as it comes in, so falling
  // back there is always an answer the element offers.
  const [pickedEnd, setPickedEnd] = useState<ElementAnimationPhase>('entrance');
  const [pickedPart, setPickedPart] = useState<MotionPart>('self');
  const end = ends.includes(pickedEnd) ? pickedEnd : 'entrance';
  const part = layout.scopeAt(pickedPart, end) !== null ? pickedPart : 'self';
  const partPicker = useMemo(() => ({ options: parts, picked: part, onPick: setPickedPart }), [parts, part]);

  const renderEnd = useCallback((shown: ElementAnimationPhase) => {
    const scope = layout.scopeAt(part, shown);
    if (scope === null) return null;
    return (
      <ElementAnimationSection
        elementId={elementId}
        kind={kind}
        scope={scope}
        supported={animationSupport === null || support.supports(animationSupport, scope, kind)}
        style={style}
        startsAt={startsAt}
        endsAt={endsAt}
        leavesAt={leavesAt}
        onReplay={onReplay}
      />
    );
  }, [layout, part, elementId, kind, animationSupport, support, style, startsAt, endsAt, leavesAt, onReplay]);

  return (
    <MotionPanelFrame
      ends={ends}
      end={end}
      onEndChange={setPickedEnd}
      partPicker={partPicker}
      renderEnd={renderEnd}
    />
  );
});
