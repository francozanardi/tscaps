import type { ReactNode } from 'react';
import { FontPicker } from '@ui/editor/components/controls/FontPicker';
import type { StyleOverrideFieldContext } from '@ui/captions/components/StyleOverridesPanel';

export interface FontFamilyFieldShape {
  fontFamily?: string;
}

const ROW_LABEL = 'text-xs text-fg-muted min-w-[70px] shrink-0 pt-[5px]';

/**
 * Font-family picker row. Shows the user's uploaded fonts grouped above
 * the curated Library catalog (see `FontPicker`). Effective value falls
 * back to baseline so the dropdown shows the sheet's font when the
 * override is unset.
 */
export function fontFamilyField<T extends FontFamilyFieldShape>(
  { current, baseline, commit }: StyleOverrideFieldContext<T>,
): ReactNode {
  const value = current.fontFamily ?? baseline.fontFamily ?? '';
  return (
    <div className="flex items-start gap-2">
      <span className={ROW_LABEL}>Font</span>
      <FontPicker
        value={value}
        onChange={(v) => commit({ fontFamily: v } as Partial<T>)}
      />
    </div>
  );
}
