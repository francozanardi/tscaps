import { memo, type ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import type { ElementAnimationPhase } from '@core/elements/domain/ElementAnimationScope';
import type { MotionPart } from '@presentation/editor/services/MotionScopeLayout';
import { ANIMATION_END_LABELS } from '@ui/_shared/components/element-fields/ElementKindLabels';
import { SegmentedChoice } from '@ui/_shared/components/controls/fields/SegmentedChoice';
import { TabStrip } from '@ui/_shared/components/TabStrip/TabStrip';

/** One part a motion panel can be answering for, as the part picker names it. */
export interface MotionPartOption {
  readonly value: MotionPart;
  readonly label: string;
}

/** The parts that move, and which of them the panel is answering for. */
export interface MotionPartPicker {
  readonly options: ReadonlyArray<MotionPartOption>;
  readonly picked: MotionPart;
  readonly onPick: (part: MotionPart) => void;
}

interface MotionPanelFrameProps {
  /** The ends offered, in the order the strip lists them. */
  ends: ReadonlyArray<ElementAnimationPhase>;
  end: ElementAnimationPhase;
  onEndChange: (end: ElementAnimationPhase) => void;
  /** Left out for something that moves as a whole; with a single option it draws nothing either. */
  partPicker?: MotionPartPicker | undefined;
  /** Sits at the strip's right edge, about the end and the part on show. */
  headerAction?: ReactNode;
  /** The body for one end, for the part on show. */
  renderEnd: (end: ElementAnimationPhase) => ReactNode;
}

const STRIP_ROW_CLASS = 'flex items-end justify-between gap-2 border-b border-edge-subtle mb-3';

/**
 * The frame every motion panel shares: a strip of the ends of the
 * element's life, the part that moves under it, and the answers for that
 * part at that end.
 *
 * **The strip is always the ends**, on a caption as on a shot layer, so
 * a reader who learned it on one knows it on the other. What moves is a
 * question of another kind — which element wears the answer — and is
 * asked with another control, a row of segments under the strip, held
 * across both ends: switching from how the words arrive to how they
 * leave stays on the words.
 *
 * A panel with one part draws no picker, since a choice of one is not a
 * choice; one with one end still draws the strip, which is what says
 * which end the answers below are for.
 */
export const MotionPanelFrame = memo(function MotionPanelFrame({
  ends,
  end,
  onEndChange,
  partPicker,
  headerAction,
  renderEnd,
}: MotionPanelFrameProps) {
  return (
    <Tabs.Root value={end} onValueChange={(value) => onEndChange(value as ElementAnimationPhase)}>
      <div className={STRIP_ROW_CLASS}>
        <TabStrip items={ends.map((value) => ({ value, label: ANIMATION_END_LABELS[value] }))} label="Which end moves" />
        {headerAction}
      </div>
      {partPicker !== undefined && partPicker.options.length > 1 && (
        <div className="mb-4">
          <SegmentedChoice
            ariaLabel="What moves"
            value={partPicker.picked}
            options={partPicker.options}
            onChange={(value) => partPicker.onPick(value as MotionPart)}
          />
        </div>
      )}
      {ends.map((value) => (
        <Tabs.Content key={value} value={value}>
          {renderEnd(value)}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
});
