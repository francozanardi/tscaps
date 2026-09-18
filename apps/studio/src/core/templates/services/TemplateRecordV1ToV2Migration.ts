import type { TemplateRecordMigration } from '@core/templates/domain/favorites/TemplateRecordMigration';
import type { StoredFontStackReader } from '@core/fonts/services/StoredFontStackReader';

/**
 * v1 → v2: replaces the one family a saved template was set in, and the
 * one each of its font controls held, with a full stack — a face per
 * writing system.
 *
 * A saved template keeps its faces spelled out rather than the id of the
 * catalog stack they came from: it was saved off a sheet whose stack the
 * reader may have tuned, and a tuned stack answers to no id.
 */
export class TemplateRecordV1ToV2Migration implements TemplateRecordMigration {
  readonly fromVersion = 1;

  constructor(private readonly fontStackReader: StoredFontStackReader) {}

  migrate(record: Record<string, unknown>): Record<string, unknown> {
    return {
      ...record,
      ...(this.isRecord(record.typography)
        ? { typography: this.fontStackReader.readTypography(record.typography) }
        : {}),
      ...(Array.isArray(record.styleControls)
        ? { styleControls: record.styleControls.map((control) => this.migrateControl(control)) }
        : {}),
    };
  }

  private migrateControl(control: unknown): unknown {
    if (!this.isRecord(control) || control.type !== 'font') return control;
    if (typeof control.default !== 'string') return control;
    return { ...control, default: this.fontStackReader.facesLedBy(control.default) };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
