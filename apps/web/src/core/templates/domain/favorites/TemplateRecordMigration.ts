/**
 * One step in the user-template payload migration chain. Upgrades a
 * persisted template record from `fromVersion` to `fromVersion + 1` —
 * never more, never less. Multi-version jumps compose through
 * `TemplateRecordMigrator` running steps in sequence.
 *
 * Implementations operate on loose records because old shapes are not
 * represented as TypeScript types: once a source version is no longer
 * current, no live code references it. Migrations should be defensive
 * about missing or unexpected fields and produce a record whose shape
 * matches the contemporary `SerializedTemplate` at `fromVersion + 1`.
 * The `version` field itself is rewritten by the migrator after each
 * step, so migrations do not update it.
 */
export interface TemplateRecordMigration {
  readonly fromVersion: number;
  migrate(record: Record<string, unknown>): Record<string, unknown>;
}
