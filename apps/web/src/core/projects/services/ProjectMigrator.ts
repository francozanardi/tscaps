import type { ProjectMigration } from '@core/projects/services/ProjectMigration';
import { ProjectV1ToV2Migration } from '@core/projects/services/ProjectV1ToV2Migration';
import { ProjectV2ToV3Migration } from '@core/projects/services/ProjectV2ToV3Migration';
import { ProjectV3ToV4Migration } from '@core/projects/services/ProjectV3ToV4Migration';
import { ProjectV4ToV5Migration } from '@core/projects/services/ProjectV4ToV5Migration';
import { ProjectV5ToV6Migration } from '@core/projects/services/ProjectV5ToV6Migration';

/**
 * Runs registered ProjectMigrations in sequence to upgrade an old serialized
 * project payload up to a target schema version. The migrator is the single
 * place where the chain is assembled and validated — gaps (missing
 * fromVersion) and downgrades (data newer than the target) are rejected
 * with explicit errors so deserialization never silently produces a
 * wrong-shaped project.
 *
 * Each time PROJECT_SCHEMA_VERSION is bumped, register a new migration in
 * the constructor that covers the new step; otherwise old projects in
 * storage will fail to load.
 */
export class ProjectMigrator {
  private readonly _byFromVersion = new Map<number, ProjectMigration>();

  constructor() {
    this.register(new ProjectV1ToV2Migration());
    this.register(new ProjectV2ToV3Migration());
    this.register(new ProjectV3ToV4Migration());
    this.register(new ProjectV4ToV5Migration());
    this.register(new ProjectV5ToV6Migration());
  }

  /**
   * Upgrades `data` from its declared `version` up to `targetVersion` by
   * applying registered migrations in order. The `version` field of the
   * intermediate payload is rewritten to match the post-step version, so
   * migrations themselves only need to worry about shape transformation.
   */
  migrate(data: Record<string, unknown>, targetVersion: number): Record<string, unknown> {
    const sourceVersion = this.readVersion(data);
    if (sourceVersion === targetVersion) return data;
    if (sourceVersion > targetVersion) {
      throw new Error(
        `Project schema version ${sourceVersion} is newer than supported (${targetVersion}). Update the app to open this project.`,
      );
    }
    let current = data;
    for (let v = sourceVersion; v < targetVersion; v++) {
      const step = this._byFromVersion.get(v);
      if (!step) {
        throw new Error(`No project migration registered from version ${v} to ${v + 1}.`);
      }
      current = { ...step.migrate(current), version: v + 1 };
    }
    return current;
  }

  private register(migration: ProjectMigration): void {
    if (this._byFromVersion.has(migration.fromVersion)) {
      throw new Error(`Duplicate project migration registered for fromVersion ${migration.fromVersion}.`);
    }
    this._byFromVersion.set(migration.fromVersion, migration);
  }

  private readVersion(data: Record<string, unknown>): number {
    const v = data.version;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
      throw new Error(`Project payload is missing a valid integer version (got ${String(v)}).`);
    }
    return v;
  }
}
