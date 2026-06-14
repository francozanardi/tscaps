import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { SheetSelector } from '@ui/pages/editor/components/sidebar/SheetSelector';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

export interface SheetScope {
  sheets: Sheet[];
  activeSheet: Sheet;
  onSetActiveSheet: (sheetId: string) => void;
  onCreateSheet: (name: string) => unknown;
  onRenameSheet: (sheetId: string, name: string) => void;
  onDeleteSheet: (sheetId: string) => void;
  onCopyStylesFromSheet: (targetSheetId: string, sourceSheetId: string) => void;
}

interface EditorTabProps {
  /** Title rendered at the top of the tab. */
  title: string;
  /** When provided, renders the SheetSelector above the title. */
  sheetScope?: SheetScope | undefined;
  /** When provided, renders a subtle reset button aligned with the title. */
  onResetToTemplate?: (() => void) | undefined;
  /** Tab-specific action(s) rendered to the right of the title — e.g. a Save button. */
  headerAction?: ReactNode | undefined;
  children: ReactNode;
}

/**
 * Shared shell for every sidebar tab. Owns the SheetSelector (when the tab
 * is sheet-scoped) and the tab title — every tab gets the same layout, so
 * tab bodies only need to render their own controls.
 *
 * The inner wrapper around `children` is the parent that `Section`'s
 * `first:border-t-0` selector targets — keep it as a separate flex container
 * even when the body has only one Section, so that section's first-child
 * border-removal still applies.
 */
export function EditorTab({ title, sheetScope, onResetToTemplate, headerAction, children }: EditorTabProps) {
  return (
    <div className="flex flex-col">
      {sheetScope && (
        // Sheets are an advanced multi-sheet workflow; mobile keeps a single
        // implicit sheet (Main). Hidden via CSS so we don't have to thread
        // viewport state through every tab.
        <div className="hidden lg:block mb-3">
          <SheetSelector
            sheets={sheetScope.sheets}
            activeSheetId={sheetScope.activeSheet.id}
            onSetActive={sheetScope.onSetActiveSheet}
            onCreate={sheetScope.onCreateSheet}
            onRename={sheetScope.onRenameSheet}
            onDelete={sheetScope.onDeleteSheet}
            onCopyStylesFromSheet={sheetScope.onCopyStylesFromSheet}
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-fg-primary m-0">
          {title}
        </h2>
        <div className="flex items-center gap-1">
          {headerAction}
          {onResetToTemplate && (
            <Tooltip text="Reset to template default">
              <button
                type="button"
                onClick={onResetToTemplate}
                aria-label="Reset to template default"
                className="inline-flex items-center justify-center w-8 h-8 rounded-xs bg-transparent border-none text-fg-faint cursor-pointer transition-colors duration-quick ease-standard hover:text-fg-secondary focus-visible:outline-none focus-visible:text-fg-secondary"
              >
                <RotateCcw size={15} strokeWidth={2} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="flex flex-col">
        {children}
      </div>
    </div>
  );
}
