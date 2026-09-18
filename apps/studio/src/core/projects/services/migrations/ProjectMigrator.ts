import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';
import { ProjectV1ToV2Migration } from '@core/projects/services/migrations/ProjectV1ToV2Migration';
import { ProjectV2ToV3Migration } from '@core/projects/services/migrations/ProjectV2ToV3Migration';
import { ProjectV3ToV4Migration } from '@core/projects/services/migrations/ProjectV3ToV4Migration';
import { ProjectV4ToV5Migration } from '@core/projects/services/migrations/ProjectV4ToV5Migration';
import { ProjectV5ToV6Migration } from '@core/projects/services/migrations/ProjectV5ToV6Migration';
import { ProjectV6ToV7Migration } from '@core/projects/services/migrations/ProjectV6ToV7Migration';
import { ProjectV7ToV8Migration } from '@core/projects/services/migrations/ProjectV7ToV8Migration';
import { ProjectV8ToV9Migration } from '@core/projects/services/migrations/ProjectV8ToV9Migration';
import { ProjectV9ToV10Migration } from '@core/projects/services/migrations/ProjectV9ToV10Migration';
import { ProjectV10ToV11Migration } from '@core/projects/services/migrations/ProjectV10ToV11Migration';
import { ProjectV11ToV12Migration } from '@core/projects/services/migrations/ProjectV11ToV12Migration';
import { ProjectV12ToV13Migration } from '@core/projects/services/migrations/ProjectV12ToV13Migration';
import { ProjectV13ToV14Migration } from '@core/projects/services/migrations/ProjectV13ToV14Migration';
import { ProjectV14ToV15Migration } from '@core/projects/services/migrations/ProjectV14ToV15Migration';
import { ProjectV15ToV16Migration } from '@core/projects/services/migrations/ProjectV15ToV16Migration';
import { ProjectV16ToV17Migration } from '@core/projects/services/migrations/ProjectV16ToV17Migration';
import { ProjectV18ToV19Migration } from '@core/projects/services/migrations/ProjectV18ToV19Migration';
import { StoredFontStackReader } from '@core/fonts/services/StoredFontStackReader';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { ProjectV17ToV18Migration } from '@core/projects/services/migrations/ProjectV17ToV18Migration';
import { StoredCaptionElementScanner } from '@core/projects/services/migrations/StoredCaptionElementScanner';
import { StoredTypographyReader } from '@core/projects/services/migrations/StoredTypographyReader';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { HorizontalPlacementResolver } from '@tscaps/engine';

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

  constructor(
    styledElementCatalog: StyledElementCatalog,
    controlCssWriter: ElementControlCssWriter,
    horizontalPlacementResolver: HorizontalPlacementResolver,
    animationCssWriter: ElementAnimationCssWriter,
  ) {
    const captionElementScanner = new StoredCaptionElementScanner();
    this.register(new ProjectV1ToV2Migration());
    this.register(new ProjectV2ToV3Migration());
    this.register(new ProjectV3ToV4Migration());
    this.register(new ProjectV4ToV5Migration());
    this.register(new ProjectV5ToV6Migration());
    this.register(new ProjectV6ToV7Migration());
    this.register(new ProjectV7ToV8Migration());
    this.register(new ProjectV8ToV9Migration());
    this.register(new ProjectV9ToV10Migration());
    this.register(new ProjectV10ToV11Migration());
    this.register(new ProjectV11ToV12Migration());
    this.register(new ProjectV12ToV13Migration());
    this.register(new ProjectV13ToV14Migration(
      captionElementScanner,
      new StoredTypographyReader(),
      styledElementCatalog,
      controlCssWriter,
    ));
    this.register(new ProjectV14ToV15Migration(captionElementScanner, horizontalPlacementResolver));
    this.register(new ProjectV15ToV16Migration(animationCssWriter));
    this.register(new ProjectV16ToV17Migration());
    this.register(new ProjectV17ToV18Migration());
    this.register(new ProjectV18ToV19Migration(
      styledElementCatalog,
      controlCssWriter,
      new StoredFontStackReader(new FontStackLibrary()),
    ));
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
