import type { ReactNode } from 'react';
import { AudioWaveform, Check, ChevronRight } from 'lucide-react';
import type { TimelineDetail } from '@core/timeline/domain/TimelineDetail';
import type { TimelineView } from '@core/timeline/domain/TimelineView';
import type { TimelineDetailVisibility } from '@presentation/timeline/controllers/TimelineVisibilityController';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { TIMELINE_VIEW_OPTIONS } from '@ui/pages/editor/features/timeline/components/TimelineViewScreen';

const ICON_SIZE_PX = 13;

/**
 * Every detail a reader can turn off, in the order they are drawn down a
 * row. One entry here and one id in {@link TimelineDetail} is the whole
 * cost of making something else optional.
 */
const DETAILS: ReadonlyArray<{ id: TimelineDetail; label: string; icon: ReactNode }> = [
  { id: 'waveform', label: 'Waveform', icon: <AudioWaveform size={ICON_SIZE_PX} /> },
];

const SCREEN_CLASS = 'p-2 flex flex-col gap-1 w-[190px] box-border';

// Separates the one choice that is always made from the details that are
// each on or off.
const DIVIDER_CLASS = 'my-1 border-t border-edge-subtle';

const VALUE_CLASS = 'shrink-0 text-fg-faint';

const ENTRY_CLASS =
  'flex items-center gap-2 w-full text-left text-2xs px-2 py-[7px] rounded-xs '
  + 'border-none bg-transparent cursor-pointer '
  + 'transition-colors duration-quick ease-standard '
  + 'hover:bg-surface-3 hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary';

const ENTRY_SHOWN_CLASS = 'text-fg-secondary';
const ENTRY_HIDDEN_CLASS = 'text-fg-faint';

const LABEL_CLASS = 'min-w-0 flex-1 truncate';

const CHECK_CLASS = 'shrink-0 text-accent';

interface VisibilityMenuScreenProps {
  view: TimelineView;
  visible: TimelineDetailVisibility;
  onToggle: (detail: TimelineDetail) => void;
}

/**
 * The level the timeline is read at, which opens a screen of its own to
 * pick from, and then the list of what a row draws, each entry turned on
 * or off on the press.
 *
 * The menu stays open afterwards: either choice redraws every row at
 * once, and closing over that would hand the reader a redrawn panel with
 * no way back that they can still see.
 */
export function VisibilityMenuScreen({ view, visible, onToggle }: VisibilityMenuScreenProps) {
  const { navigate } = usePopoverNav();
  const chosenView = TIMELINE_VIEW_OPTIONS.find((option) => option.id === view);
  return (
    <div className={SCREEN_CLASS}>
      <PopoverHeader title="View" />
      <button
        type="button"
        className={`${ENTRY_CLASS} ${ENTRY_SHOWN_CLASS}`}
        onClick={() => navigate('level')}
      >
        {chosenView?.icon}
        <span className={LABEL_CLASS}>Edit by</span>
        <span className={VALUE_CLASS}>{chosenView?.label}</span>
        <ChevronRight size={ICON_SIZE_PX} className="shrink-0 text-fg-faint" />
      </button>
      <div className={DIVIDER_CLASS} />
      {DETAILS.map((detail) => {
        const isShown = visible[detail.id];
        return (
          <button
            key={detail.id}
            type="button"
            className={`${ENTRY_CLASS} ${isShown ? ENTRY_SHOWN_CLASS : ENTRY_HIDDEN_CLASS}`}
            aria-pressed={isShown}
            onClick={() => onToggle(detail.id)}
          >
            {detail.icon}
            <span className={LABEL_CLASS}>{detail.label}</span>
            {isShown && <Check className={CHECK_CLASS} size={ICON_SIZE_PX} />}
          </button>
        );
      })}
    </div>
  );
}
