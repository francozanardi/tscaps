import type { ReactNode } from 'react';
import { ColorPicker } from '@ui/_shared/components/controls/fields/ColorPicker';
import type { StyleOverrideFieldContext } from '@ui/pages/editor/features/transcript/components/style-overrides/StyleOverridesPanel';

export interface ColorFieldShape {
  color?: string;
}

const ROW_LABEL = 'text-xs text-fg-muted min-w-[70px] shrink-0';
const COLOR_PLACEHOLDER = '#ffffff';

/** Text-color row. Falls back to `baseline.color` so the picker reflects the inherited color (e.g. segment-level override seen from a word panel). */
export function colorField<T extends ColorFieldShape>(
  { current, baseline, commit }: StyleOverrideFieldContext<T>,
): ReactNode {
  return (
    <div className="flex items-center gap-2">
      <span className={ROW_LABEL}>Text</span>
      <ColorPicker
        label=""
        value={current.color ?? baseline.color ?? COLOR_PLACEHOLDER}
        onChange={(v) => commit({ color: v } as Partial<T>)}
      />
    </div>
  );
}
