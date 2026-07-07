import { AudioWaveform, ChevronRight } from 'lucide-react';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';

const SCREEN_CLASS = 'p-2 flex flex-col gap-1.5 w-[240px] box-border';

const ACTION_BTN =
  'flex items-center gap-2 w-full text-left text-2xs px-2 py-[7px] rounded-xs border-none bg-transparent cursor-pointer whitespace-nowrap '
  + 'text-fg-secondary transition-colors duration-quick ease-standard '
  + 'hover:bg-surface-3 hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary';


/**
 * Entry screen for the auto-cut popover. Lists the available
 * auto-cut features as menu items; selecting one navigates the
 * popover to that feature's screen. Entries that depend on
 * unavailable capabilities render as gated affordances instead.
 */
export function AutoCutMenuScreen() {
  const { navigate } = usePopoverNav();
  return (
    <div className={SCREEN_CLASS}>
      <PopoverHeader title="Auto cut" />
      <button type="button" className={ACTION_BTN} onClick={() => navigate('silences')}>
        <AudioWaveform size={14} />
        <span className="flex-1">Remove silences</span>
        <ChevronRight size={13} className="text-fg-faint" />
      </button>
    </div>
  );
}
