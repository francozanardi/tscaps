import type { ReactNode } from 'react';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import type { StyleOverrideFieldContext } from '@ui/pages/editor/features/transcript/components/style-overrides/StyleOverridesPanel';

export interface PositionFieldShape {
  verticalOffset?: number;
  horizontalOffset?: number;
}

/** Two-slider row for position overrides. Always commits BOTH axes (the moved one and the visible value of the unmoved one) so the unmoved axis stays locked to its on-screen position instead of falling back to an upstream alignment with different anchor semantics. */
export function positionField<T extends PositionFieldShape>(
  { current, baseline, commit }: StyleOverrideFieldContext<T>,
): ReactNode {
  const verticalOffset = current.verticalOffset ?? baseline.verticalOffset ?? 0;
  const horizontalOffset = current.horizontalOffset ?? baseline.horizontalOffset ?? 0;
  return (
    <>
      <Slider
        label="Vertical"
        value={verticalOffset}
        min={0}
        max={1}
        step={0.01}
        compact
        onChange={(v) => commit({ verticalOffset: v, horizontalOffset } as Partial<T>)}
      />
      <Slider
        label="Horizontal"
        value={horizontalOffset}
        min={0}
        max={1}
        step={0.01}
        compact
        onChange={(v) => commit({ horizontalOffset: v, verticalOffset } as Partial<T>)}
      />
    </>
  );
}
