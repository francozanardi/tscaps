import { forwardRef, useState } from 'react';
import { ListChecks, MoreHorizontal, RotateCcw } from 'lucide-react';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

interface ShotsActionsPopoverProps {
  /** Whether any shot shows a layer that can be picked. */
  hasLayers: boolean;
  onSelectLayers: () => void;
  /** Whether the shots were edited, so proposing them again would change anything. */
  canRecalculate: boolean;
  /** Proposes the shots again. Asking first, when edits would be lost, is the caller's. */
  onRecalculate: () => void;
}

const TRIGGER_BUTTON_CLASS =
  'inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-xs bg-transparent border-none cursor-pointer '
  + 'text-fg-faint hover:text-fg-secondary hover:bg-surface-2 '
  + 'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2 '
  + 'data-[state=open]:bg-surface-3 data-[state=open]:text-fg-primary';

const NO_LAYERS_TOOLTIP = 'Add a b-roll, a picture or a GIF to a shot first.';

const SCREEN_CLASS ='p-2 flex flex-col gap-1.5 w-[240px] box-border';

const ACTION_BUTTON_CLASS =
  'flex items-center gap-2 w-full text-left text-2xs px-2 py-[7px] rounded-xs border-none bg-transparent cursor-pointer '
  + 'text-fg-secondary transition-colors duration-quick ease-standard '
  + 'hover:bg-surface-3 hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary '
  + 'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg-secondary';

/** What can be done across every shot at once, from the Shots header. */
export function ShotsActionsPopover(props: ShotsActionsPopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={<TriggerButton />}
      triggerTooltip="Shot actions"
      screens={{ menu: <MenuScreen {...props} /> }}
      initialScreen="menu"
      align="end"
    />
  );
}

const TriggerButton = forwardRef<HTMLButtonElement>(function TriggerButton(props, ref) {
  return (
    <button {...props} ref={ref} type="button" className={TRIGGER_BUTTON_CLASS} aria-label="Shot actions">
      <MoreHorizontal size={14} />
    </button>
  );
});

function MenuScreen({ hasLayers, onSelectLayers, canRecalculate, onRecalculate }: ShotsActionsPopoverProps) {
  const { close } = usePopoverNav();
  return (
    <div className={SCREEN_CLASS}>
      <PopoverHeader title="Shot actions" />
      {hasLayers ? (
        <SelectLayersButton onClick={() => { close(); onSelectLayers(); }} />
      ) : (
        // A disabled button gets no pointer events, so the tooltip hangs on a wrapper.
        <Tooltip text={NO_LAYERS_TOOLTIP} position="left">
          <div>
            <SelectLayersButton onClick={null} />
          </div>
        </Tooltip>
      )}
      <button
        type="button"
        className={ACTION_BUTTON_CLASS}
        disabled={!canRecalculate}
        onClick={() => { close(); onRecalculate(); }}
      >
        <RotateCcw size={14} />
        <span className="flex-1">Recalculate shots</span>
      </button>
    </div>
  );
}

/** The way into picking layers; disabled when `onClick` is null. */
function SelectLayersButton({ onClick }: { onClick: (() => void) | null }) {
  return (
    <button type="button" className={ACTION_BUTTON_CLASS} disabled={onClick === null} onClick={onClick ?? undefined}>
      <ListChecks size={14} />
      <span className="flex-1">Select layers</span>
    </button>
  );
}
