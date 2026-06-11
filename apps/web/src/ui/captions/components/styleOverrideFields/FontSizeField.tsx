import type { ReactNode } from 'react';
import { Slider } from '@ui/editor/components/controls/Slider';
import type { StyleOverrideFieldContext } from '@ui/captions/components/StyleOverridesPanel';

export interface FontSizeFieldShape {
  fontSize?: number;
}

// Font size lives in `cqh` (percent of video height). The upper bound is
// intentionally generous (a caption occupying up to ~25% of vertical
// space) so the user can author emphasis scenes without hitting a
// ceiling; protection against overflow is a UI responsibility, not a
// slider one. Range covers roughly 13px–320px on a 720×1280 vertical
// reference.
const FONT_SIZE_MIN = 1;
const FONT_SIZE_MAX = 25;
const FONT_SIZE_STEP = 0.1;

export function fontSizeField<T extends FontSizeFieldShape>(
  { current, baseline, commit }: StyleOverrideFieldContext<T>,
): ReactNode {
  const value = current.fontSize ?? baseline.fontSize ?? FONT_SIZE_MIN;
  return (
    <Slider
      label="Font size"
      value={value}
      min={FONT_SIZE_MIN}
      max={FONT_SIZE_MAX}
      step={FONT_SIZE_STEP}
      unit="cqh"
      compact
      onChange={(v) => commit({ fontSize: v } as Partial<T>)}
    />
  );
}
