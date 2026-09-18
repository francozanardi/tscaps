import type { EditorState } from '@core/editor/domain/EditorState';
import type { ExportAccess, ExportAccessPolicy } from '@core/export/domain/ExportAccessPolicy';

/** Allows every export when no plan restrictions apply. */
export class UnrestrictedExportAccessPolicy implements ExportAccessPolicy {
  access(_state: EditorState): ExportAccess {
    return { available: true };
  }
}
