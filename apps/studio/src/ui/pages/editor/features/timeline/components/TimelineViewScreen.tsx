import type { ReactNode } from 'react';
import { Check, RectangleHorizontal, WholeWord } from 'lucide-react';
import type { TimelineView } from '@core/timeline/domain/TimelineView';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';

const ICON_SIZE_PX = 13;

/** The levels the timeline can be read at, one of which is always chosen. */
export const TIMELINE_VIEW_OPTIONS: ReadonlyArray<{ id: TimelineView; label: string; icon: ReactNode }> = [
  { id: 'words', label: 'Words', icon: <WholeWord size={ICON_SIZE_PX} /> },
  { id: 'scenes', label: 'Scenes', icon: <RectangleHorizontal size={ICON_SIZE_PX} /> },
];

const SCREEN_CLASS = 'p-2 flex flex-col gap-1 w-[190px] box-border';

const ENTRY_CLASS =
  'flex items-center gap-2 w-full text-left text-2xs px-2 py-[7px] rounded-xs '
  + 'border-none bg-transparent cursor-pointer text-fg-secondary '
  + 'transition-colors duration-quick ease-standard '
  + 'hover:bg-surface-3 hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary';

const LABEL_CLASS = 'min-w-0 flex-1 truncate';

const CHECK_CLASS = 'shrink-0 text-accent';

interface TimelineViewScreenProps {
  view: TimelineView;
  onViewChange: (view: TimelineView) => void;
}

/**
 * Picks the level the timeline is read at. A pick goes back to the menu
 * rather than closing it, so the reader sees the choice read back while
 * the panel redraws behind it.
 */
export function TimelineViewScreen({ view, onViewChange }: TimelineViewScreenProps) {
  const { back } = usePopoverNav();
  return (
    <div className={SCREEN_CLASS}>
      <PopoverHeader title="Edit by" />
      <div role="radiogroup" aria-label="Edit by" className="flex flex-col gap-1">
        {TIMELINE_VIEW_OPTIONS.map((option) => {
          const isChosen = view === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isChosen}
              className={ENTRY_CLASS}
              onClick={() => { onViewChange(option.id); back(); }}
            >
              {option.icon}
              <span className={LABEL_CLASS}>{option.label}</span>
              {isChosen && <Check className={CHECK_CLASS} size={ICON_SIZE_PX} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
