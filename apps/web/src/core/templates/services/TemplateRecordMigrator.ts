import type { TemplateRecordMigration } from '@core/templates/domain/favorites/TemplateRecordMigration';

/**
 * Stable wire schema version for persisted user templates. Bump on
 * any non-additive change to `SerializedTemplate` and register a
 * matching `TemplateRecordMigration` step in this migrator's
 * constructor — bumping without registering the step makes every
 * stored template at the old version fail to load at boot.
 */
export const TEMPLATE_RECORD_CURRENT_VERSION = 1;

/**
 * Runs registered `TemplateRecordMigration` steps in sequence to
 * upgrade an old user-template payload up to the current schema. The
 * migrator is the single place where the chain is assembled and
 * validated — gaps (missing `fromVersion`) and downgrades (record
 * newer than the target) are rejected with explicit errors so
 * deserialization never silently produces a wrong-shaped template.
 *
 * The chain runs at read-time deserialization rather than at a
 * storage-version upgrade transaction. That choice keeps the
 * migrator decoupled from any specific storage backend, without
 * per-storage upgrade hooks. The trade-off is that stale records pay
 * a migration cost on every read instead of once at the version
 * bump; if that ever shows up in profiles, a backfill is the
 * followup.
 *
 * Decoupled from IndexedDB versioning: when the shared IndexedDB
 * `DB_VERSION` bumps for an unrelated reason (a new store, a new
 * index), no template migration is required. Only bump
 * `TEMPLATE_RECORD_CURRENT_VERSION` when the template payload shape
 * itself changes.
 */
export class TemplateRecordMigrator {
  private readonly _byFromVersion = new Map<number, TemplateRecordMigration>();

  constructor() {
    // Register steps as the schema evolves:
    // this.register(new TemplateRecordV1ToV2Migration());
  }

  /**
   * Upgrades `record` from its declared `version` up to
   * `targetVersion` by applying registered migrations in order.
   * Records persisted before the `version` field existed are treated
   * as v1 — they pre-date this task and pass through the chain from
   * that anchor.
   */
  migrate(record: Record<string, unknown>, targetVersion: number): Record<string, unknown> {
    const sourceVersion = this.readVersion(record);
    if (sourceVersion === targetVersion) return record;
    if (sourceVersion > targetVersion) {
      throw new Error(
        `Template record version ${sourceVersion} is newer than supported (${targetVersion}). Update the app to open this template.`,
      );
    }
    let current = record;
    for (let v = sourceVersion; v < targetVersion; v++) {
      const step = this._byFromVersion.get(v);
      if (!step) {
        throw new Error(`No template record migration registered from version ${v} to ${v + 1}.`);
      }
      current = { ...step.migrate(current), version: v + 1 };
    }
    return current;
  }

  private register(migration: TemplateRecordMigration): void {
    if (this._byFromVersion.has(migration.fromVersion)) {
      throw new Error(`Duplicate template record migration registered for fromVersion ${migration.fromVersion}.`);
    }
    this._byFromVersion.set(migration.fromVersion, migration);
  }

  private readVersion(record: Record<string, unknown>): number {
    const v = record.version;
    if (v === undefined) return 1;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
      throw new Error(`Template record has an invalid version field (got ${String(v)}).`);
    }
    return v;
  }
}
