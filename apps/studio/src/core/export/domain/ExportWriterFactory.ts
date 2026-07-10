import type { ExportWriter } from '@core/export/domain/ExportWriter';

/**
 * Builds a fresh {@link ExportWriter} per export. Implementations own
 * any runtime resources (workers, file handles) and isolate them per
 * call so concurrent exports cannot collide. Implementations are
 * expected to always return a usable writer; consumers do not need to
 * handle the case of "no writer available".
 */
export interface ExportWriterFactory {
  create(): ExportWriter;
}
