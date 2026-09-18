import { Check, HelpCircle, Minus } from 'lucide-react';
import { TAG_METADATA, type UserFacingTagName } from '@core/tagging/domain/TagName';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import type { WordTagRow } from '@ui/pages/editor/features/transcript/components/words/useWordTagRows';

interface WordTagsPanelProps {
  rows: ReadonlyArray<WordTagRow>;
  onToggle: (tagName: UserFacingTagName, enabled: boolean) => void;
}

const ROW_BASE =
  'flex items-center gap-1.5 w-full rounded-xs transition-colors duration-quick ease-standard';
const TOGGLE_BTN =
  'flex-1 min-w-0 flex items-center gap-1.5 text-left text-2xs px-2 py-[5px] rounded-xs ' +
  'border-none bg-transparent cursor-pointer ' +
  'text-fg-secondary hover:bg-info/10 hover:text-info focus-visible:outline-none focus-visible:bg-info/10 focus-visible:text-info ' +
  'transition-colors duration-quick ease-standard';
const TOGGLE_BTN_ACTIVE =
  'flex-1 min-w-0 flex items-center gap-1.5 text-left text-2xs px-2 py-[5px] rounded-xs ' +
  'border-none bg-info/10 cursor-pointer ' +
  'text-info hover:bg-info/15 focus-visible:outline-none focus-visible:bg-info/15 ' +
  'transition-colors duration-quick ease-standard';
const CHECK_BOX_ON =
  'flex items-center justify-center w-3.5 h-3.5 rounded-[3px] bg-info text-surface-1 shrink-0';
const CHECK_BOX_OFF =
  'flex items-center justify-center w-3.5 h-3.5 rounded-[3px] border border-edge-medium bg-surface-1 shrink-0';
const HELP_BTN =
  'flex items-center justify-center w-5 h-5 rounded-xs bg-transparent border-none text-fg-faint cursor-pointer shrink-0 ' +
  'hover:text-fg-secondary hover:bg-surface-3 focus-visible:outline-none focus-visible:text-fg-secondary focus-visible:bg-surface-3 ' +
  'transition-colors duration-quick ease-standard';
const HELP_WRAPPER = 'shrink-0';

/**
 * Semantic-tag screen for one word or for a selection of them. Each
 * row carries a checkbox and a (?) that opens the long-form
 * description on hover or tap.
 *
 * Toggling reports the tag and the state it should land in, one tag
 * per click, so an undo lands in one step per toggle.
 */
export function WordTagsPanel({ rows, onToggle }: WordTagsPanelProps) {
  return (
    <div className="p-2 flex flex-col gap-1 w-[220px] box-border">
      <PopoverHeader title="Word tags" />
      {rows.map((row) => (
        <TagRow key={row.name} row={row} onToggle={onToggle} />
      ))}
    </div>
  );
}

interface TagRowProps {
  row: WordTagRow;
  onToggle: (tagName: UserFacingTagName, enabled: boolean) => void;
}

function TagRow({ row, onToggle }: TagRowProps) {
  const meta = TAG_METADATA[row.name];
  const checked = row.checked === true;
  return (
    <div className={ROW_BASE}>
      <button
        type="button"
        className={checked ? TOGGLE_BTN_ACTIVE : TOGGLE_BTN}
        aria-pressed={row.checked === 'mixed' ? 'mixed' : checked}
        onClick={() => onToggle(row.name, !checked)}
      >
        <span className={checked ? CHECK_BOX_ON : CHECK_BOX_OFF} aria-hidden>
          {checked && <Check size={10} strokeWidth={3} />}
          {row.checked === 'mixed' && <Minus size={10} strokeWidth={3} className="text-fg-secondary" />}
        </span>
        <span className="truncate">{meta.label}</span>
      </button>
      <div className={HELP_WRAPPER}>
        <Tooltip text={meta.description} position="right" tapToOpen>
          <button
            type="button"
            className={HELP_BTN}
            aria-label={`About ${meta.label}`}
            onClick={(e) => e.stopPropagation()}
          >
            <HelpCircle size={12} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
