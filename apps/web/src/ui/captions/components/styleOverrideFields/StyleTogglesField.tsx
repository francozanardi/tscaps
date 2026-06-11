import type { ReactNode } from 'react';
import { StyleToggles } from '@ui/editor/components/controls/StyleToggles';
import type { StyleOverrideFieldContext } from '@ui/captions/components/StyleOverridesPanel';

export interface StyleTogglesFieldShape {
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

const ROW_LABEL = 'text-xs text-fg-muted min-w-[70px] shrink-0';

/**
 * Italic/underline/strikethrough row for `StyleOverridesPanel`. Each toggle
 * reads `current ?? baseline` so the displayed state matches what the user
 * is actually seeing (sheet baseline for unset fields), and commits the
 * changed key only — the panel handles dropping fields that match baseline.
 *
 * Weight has its own dedicated slider field (`fontWeightField`); it lives
 * outside this group because it's numeric, not boolean.
 */
export function styleTogglesField<T extends StyleTogglesFieldShape>(
  { current, baseline, commit }: StyleOverrideFieldContext<T>,
): ReactNode {
  const value = {
    italic: (current.italic ?? baseline.italic ?? false) as boolean,
    underline: (current.underline ?? baseline.underline ?? false) as boolean,
    strikethrough: (current.strikethrough ?? baseline.strikethrough ?? false) as boolean,
  };
  return (
    <div className="flex items-center gap-2">
      <span className={ROW_LABEL}>Style</span>
      <StyleToggles
        value={value}
        onChange={(patch) => commit(patch as Partial<T>)}
      />
    </div>
  );
}
