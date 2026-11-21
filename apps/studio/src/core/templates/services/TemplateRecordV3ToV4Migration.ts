import type { TemplateRecordMigration } from '@core/templates/domain/favorites/TemplateRecordMigration';

/**
 * v3 → v4: the `key-moments` family is renamed `magazine`. A saved
 * template inherits its family from the built-in it was saved from, so
 * one saved off ezra, elio, pastor, milo, luca, luna or levi carries the
 * old name in `metadata.category`. Every other value passes through as
 * it was.
 */
export class TemplateRecordV3ToV4Migration implements TemplateRecordMigration {
  readonly fromVersion = 3;

  migrate(record: Record<string, unknown>): Record<string, unknown> {
    if (!this.isRecord(record.metadata)) return record;
    if (record.metadata.category !== 'key-moments') return record;
    return { ...record, metadata: { ...record.metadata, category: 'magazine' } };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
