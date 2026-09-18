import { memo, useId, useState } from 'react';
import { Languages } from 'lucide-react';
import type { FontStack } from '@core/fonts/domain/FontStack';
import type { FontFaceSlot } from '@core/fonts/domain/FontScript';
import { FontPicker } from '@ui/_shared/components/controls/fields/FontPicker';
import { SCRIPT_LABELS } from '@ui/_shared/components/controls/fields/ScriptLabels';

interface FontStackFieldProps {
  label: string;
  stack: FontStack;
  /** Alphabets the captions this stack draws are written in, the most used first. */
  scripts: ReadonlyArray<FontFaceSlot>;
  onChange: (stack: FontStack) => void;
  disabled?: boolean | undefined;
}

const LABEL = 'text-xs text-fg-muted min-w-[90px] shrink-0 pt-[5px]';
// The reveal is a control of the picker's own row, not a row of its own:
// folded, the field is exactly as tall as any other, so the legend the
// field's own help renders under it stays next to the picker it explains.
const REVEAL =
  'shrink-0 w-[26px] h-[26px] flex items-center justify-center rounded-xs border cursor-pointer ' +
  'transition-colors duration-quick ease-standard ' +
  'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30';
const REVEAL_CLOSED = 'bg-surface-2 border-edge-medium text-fg-muted hover:border-edge-strong hover:text-fg-secondary';
const REVEAL_OPEN = 'bg-surface-3 border-edge-strong text-fg-primary';
// The revealed rows hang under the picker they belong to, not under the
// field's label: the rule runs in the gutter the label leaves free. The
// right inset is the reveal's own width, so every picker in the field —
// the leading one, which gives that width up, and the rows under it —
// ends on the same edge.
const FOLDED_GROUP = 'flex flex-col gap-2 ml-[85px] mr-[34px] pl-3 border-l border-edge-subtle';
// Fits `Devanagari`, the longest name offered here.
const FOLDED_LABEL = 'text-xs text-fg-muted min-w-[76px] shrink-0 pt-[5px]';

/**
 * Names what the reveal opens, so an icon alone never has to carry it.
 * Few enough alphabets are named outright; past that the count is what a
 * reader can actually take in.
 */
function revealLabel(folded: ReadonlyArray<FontFaceSlot>): string {
  const names = folded.map((script) => SCRIPT_LABELS[script].name);
  if (names.length === 1) return `Font for ${names.join('')}`;
  if (names.length === 2) return `Fonts for ${names.join(' and ')}`;
  return `Fonts for ${names.length} more alphabets`;
}

/**
 * The font the captions are set in: one picker per alphabet they are
 * written in, led by the one they hold most characters of, with the rest
 * behind a reveal at the end of that picker's row.
 *
 * Captions in a single alphabet show one dropdown and no affordance,
 * whichever alphabet that is — so the idea of a font per writing system
 * only appears to somebody whose text already mixes two.
 *
 * Each picker changes its own face and nothing else.
 */
export const FontStackField = memo(function FontStackField({
  label,
  stack,
  scripts,
  onChange,
  disabled,
}: FontStackFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const groupId = useId();
  const leading = scripts[0];
  if (leading === undefined) return null;
  const folded = scripts.slice(1);
  const reveal = revealLabel(folded);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <span className={LABEL}>{label}</span>
        <FontPicker
          value={stack.familyFor(leading)}
          forScript={leading}
          disabled={disabled}
          onChange={(family) => onChange(stack.with(leading, family))}
        />
        {folded.length > 0 && (
          <button
            type="button"
            title={reveal}
            aria-label={reveal}
            aria-expanded={expanded}
            aria-controls={groupId}
            className={REVEAL + ' ' + (expanded ? REVEAL_OPEN : REVEAL_CLOSED)}
            onClick={() => setExpanded((open) => !open)}
          >
            <Languages size={13} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      {folded.length > 0 && expanded && (
        <div id={groupId} className={FOLDED_GROUP}>
          {folded.map((script) => (
            <div key={script} className="flex items-start gap-2">
              <span className={FOLDED_LABEL}>{SCRIPT_LABELS[script].name}</span>
              <FontPicker
                value={stack.familyFor(script)}
                forScript={script}
                disabled={disabled}
                onChange={(family) => onChange(stack.with(script, family))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
