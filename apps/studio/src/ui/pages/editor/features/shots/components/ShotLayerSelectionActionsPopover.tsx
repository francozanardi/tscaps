import { forwardRef, useState, type ReactNode } from 'react';
import { Check, ChevronRight, ChevronUp, Film, ImagePlus, Layers, ListChecks, SlidersHorizontal, Trash2, X } from 'lucide-react';
import type { ShotLayerSelectOption, ShotLayerSelectOptionId } from '@presentation/shots/services/ShotLayerSelectMenu';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

interface ShotLayerSelectionActionsPopoverProps {
  /** Whether any layer is picked, which the commands need. */
  hasSelection: boolean;
  /** The entries of the *Select* screen, in order. */
  selectOptions: ReadonlyArray<ShotLayerSelectOption>;
  onEditTogether: () => void;
  /** Replaces what is picked with `layerIds`. */
  onSelect: (layerIds: ReadonlyArray<string>) => void;
  onRemove: () => void;
}

interface SelectOptionCopy {
  label: string;
  icon: ReactNode;
  /** Why it cannot be chosen, shown as its tooltip while it is disabled. */
  unavailableReason: string;
}

const SELECT_OPTION_COPY: Record<ShotLayerSelectOptionId, SelectOptionCopy> = {
  all: { label: 'All layers', icon: <Layers size={13} />, unavailableReason: 'No shot has a b-roll, a picture or a GIF.' },
  brolls: { label: 'All b-rolls', icon: <Film size={13} />, unavailableReason: 'No shot has a b-roll.' },
  pictures: { label: 'All pictures and GIFs', icon: <ImagePlus size={13} />, unavailableReason: 'No shot has a picture or a GIF.' },
  none: { label: 'Clear selection', icon: <X size={13} />, unavailableReason: 'Nothing is selected.' },
};

const TRIGGER_BUTTON_CLASS =
  'inline-flex items-center gap-1 h-7 pl-3 pr-2 shrink-0 rounded-xs border-none cursor-pointer whitespace-nowrap '
  + 'bg-accent text-fg-on-accent text-2xs font-medium hover:bg-accent-hover data-[state=open]:bg-accent-hover '
  + 'transition-colors duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2';

const SCREEN_CLASS = 'p-1 flex flex-col gap-0.5 w-[200px] box-border';
const SUB_SCREEN_CLASS = 'p-1 pt-2 flex flex-col gap-0.5 w-[200px] box-border';

const ITEM_BASE_CLASS =
  'flex items-center gap-2 w-full text-left text-2xs px-2 py-[7px] rounded-xs border-none bg-transparent cursor-pointer whitespace-nowrap '
  + 'transition-colors duration-quick ease-standard focus-visible:outline-none '
  + 'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent';
const ITEM_CLASS =
  `${ITEM_BASE_CLASS} text-fg-secondary hover:bg-surface-3 hover:text-fg-primary `
  + 'focus-visible:bg-surface-3 focus-visible:text-fg-primary disabled:hover:text-fg-secondary';
const DANGER_ITEM_CLASS =
  `${ITEM_BASE_CLASS} text-danger/75 hover:bg-danger/10 hover:text-danger `
  + 'focus-visible:bg-danger/10 focus-visible:text-danger disabled:hover:text-danger/75';

/**
 * What can be done while layers are being picked, behind the bar's
 * primary *Actions* button so the bar stays a single row: edit or
 * remove what is picked, or replace it from the *Select* screen (every
 * layer, every layer of a kind, none). An entry that matches what is
 * picked carries a check. Opens upwards, away from the bar's place at
 * the bottom of the panel.
 */
export function ShotLayerSelectionActionsPopover(props: ShotLayerSelectionActionsPopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={<TriggerButton />}
      screens={{
        menu: <MenuScreen {...props} />,
        select: <SelectScreen options={props.selectOptions} onSelect={props.onSelect} />,
      }}
      initialScreen="menu"
      side="top"
      align="end"
    />
  );
}

const TriggerButton = forwardRef<HTMLButtonElement>(function TriggerButton(props, ref) {
  return (
    <button {...props} ref={ref} type="button" className={TRIGGER_BUTTON_CLASS}>
      Actions <ChevronUp size={13} aria-hidden />
    </button>
  );
});

function MenuScreen(props: ShotLayerSelectionActionsPopoverProps) {
  const { hasSelection } = props;
  const { navigate, close } = usePopoverNav();
  const run = (action: () => void) => () => { close(); action(); };
  return (
    <div className={SCREEN_CLASS}>
      <button type="button" className={ITEM_CLASS} disabled={!hasSelection} onClick={run(props.onEditTogether)}>
        <SlidersHorizontal size={13} /> Edit together
      </button>
      <button type="button" className={ITEM_CLASS} onClick={() => navigate('select')}>
        <ListChecks size={13} />
        <span className="flex-1">Select</span>
        <ChevronRight size={13} className="text-fg-faint" aria-hidden />
      </button>
      <div className="mx-2 my-1 border-t border-edge-subtle" />
      <button type="button" className={DANGER_ITEM_CLASS} disabled={!hasSelection} onClick={run(props.onRemove)}>
        <Trash2 size={13} /> Remove
      </button>
    </div>
  );
}

interface SelectScreenProps {
  options: ReadonlyArray<ShotLayerSelectOption>;
  onSelect: (layerIds: ReadonlyArray<string>) => void;
}

function SelectScreen({ options, onSelect }: SelectScreenProps) {
  const { close } = usePopoverNav();
  return (
    <div className={SUB_SCREEN_CLASS}>
      <div className="px-1 pb-1">
        <PopoverHeader title="Select" />
      </div>
      {options.map((option) => (
        <SelectOptionItem key={option.id} option={option} onChoose={() => { close(); onSelect(option.layerIds); }} />
      ))}
    </div>
  );
}

function SelectOptionItem({ option, onChoose }: { option: ShotLayerSelectOption; onChoose: () => void }) {
  const copy = SELECT_OPTION_COPY[option.id];
  if (!option.isAvailable) {
    // A disabled button gets no pointer events, so the tooltip hangs on a wrapper.
    return (
      <Tooltip text={copy.unavailableReason} position="left">
        <div>
          <button type="button" className={ITEM_CLASS} disabled>
            {copy.icon}
            <span className="flex-1">{copy.label}</span>
          </button>
        </div>
      </Tooltip>
    );
  }
  return (
    <button type="button" className={ITEM_CLASS} onClick={onChoose}>
      {copy.icon}
      <span className="flex-1">{copy.label}</span>
      {option.isApplied && <Check size={13} aria-label="Already selected" />}
    </button>
  );
}
