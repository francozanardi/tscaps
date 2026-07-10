import type { ReactNode } from 'react';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import type { StyleOverrideFieldContext } from '@ui/pages/editor/features/transcript/components/style-overrides/StyleOverridesPanel';

export interface FontWeightFieldShape {
  fontWeight?: number;
}

const FONT_WEIGHT_MIN = 100;
const FONT_WEIGHT_MAX = 900;
const FONT_WEIGHT_STEP = 100;

export function fontWeightField<T extends FontWeightFieldShape>(
  { current, baseline, commit }: StyleOverrideFieldContext<T>,
): ReactNode {
  const value = current.fontWeight ?? baseline.fontWeight ?? FONT_WEIGHT_MIN;
  return (
    <Slider
      label="Weight"
      value={value}
      min={FONT_WEIGHT_MIN}
      max={FONT_WEIGHT_MAX}
      step={FONT_WEIGHT_STEP}
      compact
      onChange={(v) => commit({ fontWeight: v } as Partial<T>)}
    />
  );
}
