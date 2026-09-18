import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { PromptDialog } from '@ui/_shared/components/Dialog/PromptDialog';
import { POPOVER_MENU_SHAPE, POPOVER_ITEM, POPOVER_ITEM_MOVE } from '@ui/pages/editor/features/transcript/transcript-classes';

interface TranscriptSheetPickerScreenProps {
  sheets: ReadonlyArray<Sheet>;
  assignedSheetId: string | null;
  onAssign: (sheetId: string) => void;
  onCreateSheet: (name: string) => string | null;
}

/** Shared sheet picker for one scene or an explicit scene selection. */
export function TranscriptSheetPickerScreen({
  sheets,
  assignedSheetId,
  onAssign,
  onCreateSheet,
}: TranscriptSheetPickerScreenProps) {
  const { close } = usePopoverNav();
  const [promptOpen, setPromptOpen] = useState(false);

  const assign = (sheetId: string) => {
    if (assignedSheetId !== sheetId) onAssign(sheetId);
    close();
  };

  const createAndAssign = (name: string) => {
    setPromptOpen(false);
    const sheetId = onCreateSheet(name);
    if (sheetId) onAssign(sheetId);
    close();
  };

  return (
    <div className={POPOVER_MENU_SHAPE}>
      <PopoverHeader title="Style sheet" />
      {sheets.map((sheet) => {
        const isAssigned = assignedSheetId === sheet.id;
        const isMain = sheet.color === null;
        return (
          <button key={sheet.id} className={POPOVER_ITEM} onClick={() => assign(sheet.id)}>
            <span
              className={isMain
                ? 'w-2.5 h-2.5 rounded-full bg-transparent border border-edge-strong shrink-0'
                : 'w-2.5 h-2.5 rounded-full bg-edge-strong shrink-0'}
              style={sheet.color ? { background: sheet.color } : undefined}
            />
            <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">{sheet.name}</span>
            {isAssigned && <Check size={12} />}
          </button>
        );
      })}
      <button className={POPOVER_ITEM_MOVE} onClick={() => setPromptOpen(true)}>
        <Plus size={13} /> New sheet…
      </button>
      <PromptDialog
        open={promptOpen}
        label="Style sheet name"
        defaultValue="New sheet"
        confirmLabel="Create"
        onConfirm={createAndAssign}
        onCancel={() => setPromptOpen(false)}
      />
    </div>
  );
}
