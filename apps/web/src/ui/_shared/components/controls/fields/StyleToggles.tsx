import { memo, type ReactNode } from 'react';
import { Italic, Underline, Strikethrough } from 'lucide-react';

export interface StyleTogglesValue {
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
}

interface StyleTogglesProps {
  value: StyleTogglesValue;
  onChange: (patch: Partial<StyleTogglesValue>) => void;
}

const TOGGLES: ReadonlyArray<{ key: keyof StyleTogglesValue; tooltip: string; icon: ReactNode }> = [
  { key: 'italic', tooltip: 'Italic', icon: <Italic size={13} /> },
  { key: 'underline', tooltip: 'Underline', icon: <Underline size={13} /> },
  { key: 'strikethrough', tooltip: 'Strikethrough', icon: <Strikethrough size={13} /> },
];

const TOGGLE_BASE =
  'flex items-center justify-center w-7 h-6 rounded-xs cursor-pointer ' +
  'transition-colors duration-quick ease-standard ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30';
const ACTIVE = `${TOGGLE_BASE} bg-accent/20 text-fg-primary border border-accent`;
const INACTIVE = `${TOGGLE_BASE} bg-transparent text-fg-secondary border border-transparent hover:bg-surface-3`;

/**
 * Italic/underline/strikethrough toggle group. Bold has its own dedicated
 * Weight slider — the binary toggle was dropped when typography moved to
 * a numeric `fontWeight` (variable fonts make the full 100..900 range
 * meaningful, so a 2-state toggle is the wrong primitive). The wrapping
 * `<div>` (segmented-style border + background) is part of this atom;
 * callers provide their own row/label around it.
 */
export const StyleToggles = memo(function StyleToggles({ value, onChange }: StyleTogglesProps) {
  return (
    <div
      className="flex rounded-xs border border-edge-medium bg-surface-2 p-[2px] gap-[2px]"
      role="group"
      aria-label="Style"
    >
      {TOGGLES.map((t) => {
        const active = value[t.key];
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={active}
            title={t.tooltip}
            className={active ? ACTIVE : INACTIVE}
            onClick={() => onChange({ [t.key]: !active } as Partial<StyleTogglesValue>)}
          >
            {t.icon}
          </button>
        );
      })}
    </div>
  );
});
