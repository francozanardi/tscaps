import { forwardRef, type ReactNode } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { ChevronRight, EyeOff, ListChecks, Megaphone, Wand2 } from 'lucide-react';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';

interface TranscriptActionsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetHookScenes: () => void;
  onSelectScenes: () => void;
  onSelectWords: () => void;
  /** Whether scenes on screen too briefly to read are left out of the video. */
  briefScenesHidden: boolean;
  onBriefScenesHiddenChange: (hidden: boolean) => void;
}

const TRIGGER_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer ' +
  'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2 ' +
  'data-[state=open]:bg-surface-3 data-[state=open]:text-fg-primary';

const SCREEN_CLASS = 'p-2 flex flex-col gap-1.5 w-[240px] box-border';

const ACTION_BTN =
  'flex items-center gap-2 w-full text-left text-2xs px-2 py-[7px] rounded-xs border-none bg-transparent cursor-pointer whitespace-nowrap ' +
  'text-fg-secondary transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-3 hover:text-fg-primary ' +
  'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary ' +
  'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg-secondary';

// The row itself is the switch, so the track is drawn off its state.
const SWITCH_TRACK =
  'relative inline-flex shrink-0 w-7 h-4 rounded-pill bg-surface-3 border border-edge-medium ' +
  'transition-colors duration-quick ease-standard ' +
  'group-data-[state=checked]:bg-accent/25 group-data-[state=checked]:border-accent';

const SWITCH_THUMB =
  'block w-3 h-3 mt-px rounded-full bg-fg-muted translate-x-px ' +
  'transition-[transform,background-color] duration-quick ease-standard will-change-transform ' +
  'data-[state=checked]:translate-x-[13px] data-[state=checked]:bg-accent';

/**
 * Popover anchored to the transcript topbar that lists actions available
 * on the whole transcript. Entries can target its scene structure or switch
 * among independently editable caption versions.
 */
export function TranscriptActionsPopover({
  open,
  onOpenChange,
  onSetHookScenes,
  onSelectScenes,
  onSelectWords,
  briefScenesHidden,
  onBriefScenesHiddenChange,
}: TranscriptActionsPopoverProps) {
  const extension = { menuItem: null, screens: {}, layer: null };
  return (
    <>
      <Popover
        open={open}
        onOpenChange={onOpenChange}
        trigger={<TriggerButton />}
        triggerTooltip="Transcript actions"
        screens={{
          menu: (
            <MenuScreen
              extraAction={extension.menuItem}
              onSetHookScenes={onSetHookScenes}
              briefScenesHidden={briefScenesHidden}
              onBriefScenesHiddenChange={onBriefScenesHiddenChange}
            />
          ),
          selectMultiple: (
            <SelectMultipleScreen
              onSelectScenes={onSelectScenes}
              onSelectWords={onSelectWords}
            />
          ),
          ...extension.screens,
        }}
        initialScreen="menu"
        align="end"
      />
      {extension.layer}
    </>
  );
}

const TriggerButton = forwardRef<HTMLButtonElement>(
  function TriggerButton(props, ref) {
    return (
      <button
        {...props}
        ref={ref}
        type="button"
        className={TRIGGER_BTN}
        aria-label="Transcript actions"
      >
        <Wand2 size={14} />
      </button>
    );
  },
);

type MenuScreenProps =
  Pick<TranscriptActionsPopoverProps, 'onSetHookScenes' | 'briefScenesHidden' | 'onBriefScenesHiddenChange'>
  & { extraAction: ReactNode };

function MenuScreen({
  extraAction,
  onSetHookScenes,
  briefScenesHidden,
  onBriefScenesHiddenChange,
}: MenuScreenProps) {
  const { navigate, close } = usePopoverNav();
  return (
    <div className={SCREEN_CLASS}>
      <PopoverHeader title="Transcript actions" />
      <button type="button" className={ACTION_BTN} onClick={() => navigate('selectMultiple')}>
        <ListChecks size={14} />
        <span className="flex-1">Select multiple</span>
        <ChevronRight size={12} />
      </button>
      <button
        type="button"
        className={ACTION_BTN}
        onClick={() => { close(); onSetHookScenes(); }}
      >
        <Megaphone size={14} />
        <span className="flex-1">Set hook scenes</span>
      </button>
      <Switch.Root
        checked={briefScenesHidden}
        onCheckedChange={onBriefScenesHiddenChange}
        className={`group ${ACTION_BTN}`}
      >
        <EyeOff size={14} />
        <span className="flex-1">Hide brief scenes</span>
        <span className={SWITCH_TRACK}>
          <Switch.Thumb className={SWITCH_THUMB} />
        </span>
      </Switch.Root>
      {extraAction}
    </div>
  );
}

function SelectMultipleScreen({
  onSelectScenes,
  onSelectWords,
}: Pick<TranscriptActionsPopoverProps, 'onSelectScenes' | 'onSelectWords'>) {
  const { close } = usePopoverNav();
  return (
    <div className={SCREEN_CLASS}>
      <PopoverHeader title="Select multiple" />
      <button type="button" className={ACTION_BTN} onClick={() => { close(); onSelectScenes(); }}>
        <ListChecks size={14} />
        <span className="flex-1">Scenes</span>
      </button>
      <button type="button" className={ACTION_BTN} onClick={() => { close(); onSelectWords(); }}>
        <ListChecks size={14} />
        <span className="flex-1">Words</span>
      </button>
    </div>
  );
}
