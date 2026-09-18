import type { Document } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SheetScriptsSynchronizer } from '@core/sheets/services/SheetScriptsSynchronizer';

/** Keeps font routing current after text edits and undo, without running the splitter pipeline. */
export class SheetScriptsAutomation {
  private document: Document | null = null;
  private sheets: ReadonlyArray<Sheet> | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly synchronizer: SheetScriptsSynchronizer,
  ) {}

  start(): void {
    this.store.addEventListener('change', this.sync);
    this.sync();
  }

  stop(): void {
    this.store.removeEventListener('change', this.sync);
    this.document = null;
    this.sheets = null;
  }

  private readonly sync = (): void => {
    const { document, sheets } = this.store.snapshot();
    if (document === this.document && sheets === this.sheets) return;
    this.document = document;
    this.sheets = sheets;
    if (!document) return;
    const synced = this.synchronizer.sync(document, sheets);
    if (synced === sheets) return;
    // Remember the outgoing identity before the synchronous store notification.
    const nextSheets = [...synced];
    this.sheets = nextSheets;
    this.store.patch({ sheets: nextSheets });
  };
}
