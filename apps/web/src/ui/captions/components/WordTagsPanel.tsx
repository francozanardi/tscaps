import { useMemo } from 'react';
import { Check, HelpCircle } from 'lucide-react';
import type { Word } from '@tscaps/engine';
import { TAG_METADATA, type TagName } from '@core/tagging/domain/TagName';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { useTagging } from '@ui/_shared/contexts/modules/TaggingContext';

interface WordTagsPanelProps {
  word: Word;
  onCommit: (tagNames: ReadonlySet<string>) => void;
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
const EMPTY_HINT = 'text-2xs text-fg-faint px-1 py-2 leading-snug';

/**
 * Word-level semantic-tag screen. Lists every tag the platform can
 * actually attach right now (taken from the live tagger registry, not
 * the canonical vocabulary), with a checkbox toggle per row and a (?)
 * that opens the long-form description on hover or tap. Each toggle
 * commits the whole next set immediately so an undo/redo lands in one
 * step per toggle.
 */
export function WordTagsPanel({ word, onCommit }: WordTagsPanelProps) {
  const tagging = useTagging();
  const availableTagNames = tagging.registry.listActiveTagNames();

  const activeTagNames = useMemo(() => {
    const names = new Set<string>();
    for (const tag of word.semanticTags) names.add(tag.name);
    return names;
  }, [word.semanticTags]);

  const toggle = (name: TagName) => {
    const next = new Set(activeTagNames);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onCommit(next);
  };

  return (
    <div className="p-2 flex flex-col gap-1 w-[220px] box-border">
      <PopoverHeader title="Word tags" />
      {availableTagNames.length === 0 ? (
        <p className={EMPTY_HINT}>
          No semantic taggers are wired for this surface, so nothing to assign.
        </p>
      ) : (
        availableTagNames.map((name) => (
          <TagRow
            key={name}
            name={name}
            checked={activeTagNames.has(name)}
            onToggle={toggle}
          />
        ))
      )}
    </div>
  );
}

interface TagRowProps {
  name: TagName;
  checked: boolean;
  onToggle: (name: TagName) => void;
}

function TagRow({ name, checked, onToggle }: TagRowProps) {
  const meta = TAG_METADATA[name];
  return (
    <div className={ROW_BASE}>
      <button
        type="button"
        className={checked ? TOGGLE_BTN_ACTIVE : TOGGLE_BTN}
        aria-pressed={checked}
        onClick={() => onToggle(name)}
      >
        <span className={checked ? CHECK_BOX_ON : CHECK_BOX_OFF} aria-hidden>
          {checked && <Check size={10} strokeWidth={3} />}
        </span>
        <span className="truncate">{meta.label}</span>
      </button>
      <div className={HELP_WRAPPER}>
        <Tooltip text={meta.description} position="left" tapToOpen>
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
