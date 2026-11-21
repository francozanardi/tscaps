import type { ExportWriterFactory } from '@core/export/domain/ExportWriterFactory';

/** How an export written to a file the program named ended: finished with its size, or not finished. */
export type ExportFileOutcome =
  | { readonly kind: 'written'; readonly bytes: number }
  | { readonly kind: 'aborted' }
  | { readonly kind: 'not-started' };

/**
 * Builds the writers of one export whose bytes go to a file the program
 * driving the page named, and tells how the last one ended.
 */
export interface ExportFileTarget extends ExportWriterFactory {
  outcome(): ExportFileOutcome;
}

/** Makes an `ExportFileTarget` for each file the program names. */
export interface ExportFileTargets {
  targetFor(fileId: string): ExportFileTarget;
}
