/**
 * One step in the project schema migration chain. A migration upgrades a
 * serialized payload from `fromVersion` to `fromVersion + 1` — never more,
 * never less. Multi-version jumps are composed by ProjectMigrator running
 * migrations in sequence.
 *
 * Implementations operate on loose records because old shapes are not
 * represented as TypeScript types: once the source version is no longer
 * current, no live code references it. Migrations should be defensive
 * about missing or unexpected fields and produce a payload whose shape
 * matches the contemporary SerializedProject at `fromVersion + 1`. The
 * `version` field itself is rewritten by the migrator after each step,
 * so migrations do not need to update it themselves.
 */
export interface ProjectMigration {
  readonly fromVersion: number;
  migrate(data: Record<string, unknown>): Record<string, unknown>;
}
