import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import { ConfirmDialog } from '@ui/_shared/components/Dialog/ConfirmDialog';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { EditSheetDialog, type EditSheetDialogResult } from '@ui/editor/components/sidebar/EditSheetDialog';
import { SheetSettingsPopover } from '@ui/editor/components/sidebar/SheetSettingsPopover';

interface SheetSelectorProps {
  sheets: Sheet[];
  activeSheetId: string;
  onSetActive: (sheetId: string) => void;
  onCreate: (name: string) => unknown;
  onRename: (sheetId: string, name: string) => void;
  onDelete: (sheetId: string) => void;
  onCopyStylesFromSheet: (targetSheetId: string, sourceSheetId: string) => void;
}

const CHIP_BASE =
  'group/chip inline-flex items-center gap-2 pl-2.5 pr-1.5 h-8 rounded-sm border text-sm font-medium ' +
  'transition-[background-color,border-color,box-shadow] duration-quick ease-standard';
const CHIP_INACTIVE = `${CHIP_BASE} bg-transparent border-edge-medium hover:bg-surface-2 hover:border-edge-strong`;
const CHIP_ACTIVE = `${CHIP_BASE} bg-surface-3 shadow-raised`;

const CHIP_SELECT_BASE =
  'inline-flex items-center gap-2 bg-transparent border-none p-0 cursor-pointer min-w-0 outline-none ' +
  'focus-visible:text-fg-primary';
const CHIP_SELECT_INACTIVE = `${CHIP_SELECT_BASE} text-fg-secondary group-hover/chip:text-fg-primary`;
const CHIP_SELECT_ACTIVE = `${CHIP_SELECT_BASE} text-fg-primary`;

const CHIP_DOT = 'w-2.5 h-2.5 rounded-full bg-edge-strong shrink-0 ring-1 ring-inset ring-black/30';

const CHIP_ICON_BASE =
  'inline-flex items-center justify-center w-5 h-5 rounded-xs border-none bg-transparent cursor-pointer ' +
  'transition-colors duration-quick ease-standard ' +
  'focus-visible:outline-none';
const CHIP_DELETE = `${CHIP_ICON_BASE} text-fg-faint hover:bg-danger/15 hover:text-danger focus-visible:bg-danger/15 focus-visible:text-danger`;

interface MenuState {
  sheet: Sheet;
  point: { x: number; y: number };
}

export function SheetSelector({
  sheets,
  activeSheetId,
  onSetActive,
  onCreate,
  onRename,
  onDelete,
  onCopyStylesFromSheet,
}: SheetSelectorProps) {
  const [createOpen, setCreateOpen] = useState(false);
  // Settings popover state. Both left-click on the active chip and
  // right-click on any chip open this popover anchored under the chip;
  // right-click is just an alternative entry point for discoverability.
  const [menu, setMenu] = useState<MenuState | null>(null);
  // Sheet currently being renamed (drives EditSheetDialog). Decoupled
  // from the popover so the popover can close cleanly before the dialog
  // animates in.
  const [renaming, setRenaming] = useState<Sheet | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Sheet | null>(null);

  if (sheets.length === 0) return null;

  const isMultiSheet = sheets.length > 1;
  const wrapperClass = isMultiSheet
    ? 'sticky top-0 z-10 bg-surface-1 py-2 border-b border-edge-medium flex items-center flex-wrap gap-1.5'
    : 'pb-3 border-b border-edge-subtle flex items-center flex-wrap gap-1.5';

  const openMenuUnder = (sheet: Sheet, element: Element) => {
    const rect = element.getBoundingClientRect();
    setMenu({ sheet, point: { x: rect.left, y: rect.bottom + 4 } });
  };

  const handleSelectClick = (sheet: Sheet, e: React.MouseEvent<HTMLButtonElement>) => {
    if (sheet.id === activeSheetId) {
      openMenuUnder(sheet, e.currentTarget);
    } else {
      onSetActive(sheet.id);
    }
  };

  const handleContextMenu = (sheet: Sheet, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    openMenuUnder(sheet, e.currentTarget);
  };

  const handleCreateConfirm = (result: EditSheetDialogResult) => {
    setCreateOpen(false);
    onCreate(result.name);
  };

  const handleRenameConfirm = (sheet: Sheet, result: EditSheetDialogResult) => {
    setRenaming(null);
    if (result.name !== sheet.name) onRename(sheet.id, result.name);
  };

  return (
    <>
      <div className={wrapperClass}>
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheetId;
          const isMain = sheet.id === MAIN_SHEET_ID;
          const activeBorderStyle = isActive
            ? { borderColor: sheet.color ?? 'rgb(var(--color-accent))' }
            : undefined;
          return (
            <div
              key={sheet.id}
              className={isActive ? CHIP_ACTIVE : CHIP_INACTIVE}
              style={activeBorderStyle}
              onContextMenu={(e) => handleContextMenu(sheet, e)}
            >
              <Tooltip text={isActive ? 'Open sheet options' : 'Switch to this sheet'} position="top">
                <button
                  type="button"
                  className={isActive ? CHIP_SELECT_ACTIVE : CHIP_SELECT_INACTIVE}
                  onClick={(e) => handleSelectClick(sheet, e)}
                >
                  <span
                    className={CHIP_DOT}
                    style={sheet.color ? { background: sheet.color } : undefined}
                    data-main={isMain ? 'true' : undefined}
                  />
                  <span className="whitespace-nowrap max-w-[140px] overflow-hidden text-ellipsis">
                    {sheet.name}
                  </span>
                </button>
              </Tooltip>
              {!isMain && (
                <Tooltip text={`Delete sheet "${sheet.name}"`} position="top">
                  <button
                    type="button"
                    className={CHIP_DELETE}
                    onClick={() => setPendingDelete(sheet)}
                    aria-label={`Delete sheet ${sheet.name}`}
                  >
                    <X size={12} />
                  </button>
                </Tooltip>
              )}
            </div>
          );
        })}
        <Tooltip text="Add a style sheet. Style sheets let you define different looks and assign them to scenes in the Captions tab." position="bottom">
          <button
            className="inline-flex items-center justify-center w-8 h-8 rounded-sm border border-dashed border-edge-medium bg-transparent text-fg-faint cursor-pointer transition-colors duration-quick ease-standard hover:bg-surface-2 hover:border-edge-strong hover:text-fg-secondary focus-visible:outline-none focus-visible:border-accent focus-visible:text-fg-secondary"
            onClick={() => setCreateOpen(true)}
            aria-label="New sheet"
          >
            <Plus size={14} />
          </button>
        </Tooltip>
      </div>

      {menu && (
        <SheetSettingsPopover
          open
          onOpenChange={(o) => { if (!o) setMenu(null); }}
          point={menu.point}
          sheet={menu.sheet}
          sheets={sheets}
          onRequestRename={() => { setMenu(null); setRenaming(menu.sheet); }}
          onCopyStylesFromSheet={(sourceId) => onCopyStylesFromSheet(menu.sheet.id, sourceId)}
        />
      )}

      <EditSheetDialog
        open={createOpen}
        sheet={null}
        onConfirm={handleCreateConfirm}
        onCancel={() => setCreateOpen(false)}
      />

      <EditSheetDialog
        open={renaming !== null}
        sheet={renaming}
        onConfirm={(result) => { if (renaming) handleRenameConfirm(renaming, result); }}
        onCancel={() => setRenaming(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        message={`Delete sheet "${pendingDelete?.name}"? Scenes using it will fall back to Main.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => { if (pendingDelete) onDelete(pendingDelete.id); setPendingDelete(null); }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
