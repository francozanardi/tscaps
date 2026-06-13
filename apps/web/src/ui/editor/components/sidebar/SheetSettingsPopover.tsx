import { Copy, Pencil } from 'lucide-react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';

interface SheetSettingsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Viewport-space anchor — bottom-left of the chip for left-click, cursor for right-click. */
  point: { x: number; y: number };
  /** The sheet whose menu this popover represents (the target of any action). */
  sheet: Sheet;
  /** All sheets, used by the source picker. */
  sheets: ReadonlyArray<Sheet>;
  onRequestRename: () => void;
  onCopyStylesFromSheet: (sourceSheetId: string) => void;
}

const MENU_SHAPE = 'p-1 flex flex-col gap-0.5 min-w-[220px]';
const ITEM =
  'flex items-center gap-2 text-left w-full text-2xs px-2 py-[5px] rounded-xs border-none bg-transparent cursor-pointer whitespace-nowrap ' +
  'transition-colors duration-quick ease-standard text-fg-secondary hover:bg-surface-3 hover:text-fg-primary ' +
  'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg-secondary';

/**
 * Settings popover for a sheet chip. Point-anchored so it serves both
 * the left-click-on-active-chip flow (anchored under the chip) and the
 * right-click flow (anchored at the chip), without two parallel popover
 * trees. Two screens: the menu (verbs) and the source-sheet picker for
 * "Copy styles from…".
 */
export function SheetSettingsPopover(props: SheetSettingsPopoverProps) {
  const screens = {
    menu: <SheetMenuScreen {...props} />,
    sheetPicker: <SheetSourcePickerScreen {...props} />,
  };
  return (
    <Popover
      open={props.open}
      onOpenChange={props.onOpenChange}
      point={props.point}
      screens={screens}
      initialScreen="menu"
    />
  );
}

function SheetMenuScreen({ sheets, onRequestRename }: SheetSettingsPopoverProps) {
  const { navigate, close } = usePopoverNav();
  const canCopy = sheets.length > 1;
  return (
    <div className={MENU_SHAPE}>
      <button
        type="button"
        className={ITEM}
        onClick={() => { close(); onRequestRename(); }}
      >
        <Pencil size={13} /> Rename…
      </button>
      <button
        type="button"
        className={ITEM}
        onClick={() => navigate('sheetPicker')}
        disabled={!canCopy}
        title={canCopy ? undefined : 'Create at least one more sheet to copy styles from.'}
      >
        <Copy size={13} /> Copy styles from…
      </button>
    </div>
  );
}

function SheetSourcePickerScreen({ sheets, sheet, onCopyStylesFromSheet }: SheetSettingsPopoverProps) {
  const { close } = usePopoverNav();
  const candidates = sheets.filter((s) => s.id !== sheet.id);

  const handlePick = (sourceId: string) => {
    onCopyStylesFromSheet(sourceId);
    close();
  };

  return (
    <div className={MENU_SHAPE}>
      <PopoverHeader title="Copy styles from" />
      {candidates.map((s) => {
        const isMain = s.id === MAIN_SHEET_ID;
        return (
          <button
            key={s.id}
            type="button"
            className={ITEM}
            onClick={() => handlePick(s.id)}
          >
            <span
              className={
                isMain
                  ? 'w-2.5 h-2.5 rounded-full bg-transparent border border-edge-strong shrink-0'
                  : 'w-2.5 h-2.5 rounded-full bg-edge-strong shrink-0'
              }
              style={s.color ? { background: s.color } : undefined}
            />
            <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">{s.name}</span>
          </button>
        );
      })}
    </div>
  );
}
