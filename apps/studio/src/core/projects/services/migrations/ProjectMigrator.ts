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
import { ProjectV19ToV20Migration } from '@core/projects/services/migrations/ProjectV19ToV20Migration';
import { ProjectV20ToV21Migration } from '@core/projects/services/migrations/ProjectV20ToV21Migration';
import { ProjectV21ToV22Migration } from '@core/projects/services/migrations/ProjectV21ToV22Migration';
import { ProjectV22ToV23Migration } from '@core/projects/services/migrations/ProjectV22ToV23Migration';
import { ProjectV23ToV24Migration } from '@core/projects/services/migrations/ProjectV23ToV24Migration';
import { ProjectV24ToV25Migration } from '@core/projects/services/migrations/ProjectV24ToV25Migration';
import { ProjectV25ToV26Migration } from '@core/projects/services/migrations/ProjectV25ToV26Migration';
import { ProjectV26ToV27Migration } from '@core/projects/services/migrations/ProjectV26ToV27Migration';
import { ProjectV27ToV28Migration } from '@core/projects/services/migrations/ProjectV27ToV28Migration';
import { ProjectV28ToV29Migration } from '@core/projects/services/migrations/ProjectV28ToV29Migration';
import { ProjectV29ToV30Migration } from '@core/projects/services/migrations/ProjectV29ToV30Migration';
import { ProjectV30ToV31Migration } from '@core/projects/services/migrations/ProjectV30ToV31Migration';
import { ProjectV31ToV32Migration } from '@core/projects/services/migrations/ProjectV31ToV32Migration';
import { ProjectV32ToV33Migration } from '@core/projects/services/migrations/ProjectV32ToV33Migration';
import { ProjectV33ToV34Migration } from '@core/projects/services/migrations/ProjectV33ToV34Migration';
import { ProjectV34ToV35Migration } from '@core/projects/services/migrations/ProjectV34ToV35Migration';
import { ProjectV35ToV36Migration } from '@core/projects/services/migrations/ProjectV35ToV36Migration';
import { ProjectV36ToV37Migration } from '@core/projects/services/migrations/ProjectV36ToV37Migration';
import { ProjectV37ToV38Migration } from '@core/projects/services/migrations/ProjectV37ToV38Migration';
import { ProjectV38ToV39Migration } from '@core/projects/services/migrations/ProjectV38ToV39Migration';
import { StoredFontStackReader } from '@core/fonts/services/StoredFontStackReader';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { ProjectV17ToV18Migration } from '@core/projects/services/migrations/ProjectV17ToV18Migration';
import { StoredCaptionElementScanner } from '@core/projects/services/migrations/StoredCaptionElementScanner';
import { StoredTypographyReader } from '@core/projects/services/migrations/StoredTypographyReader';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import type { HorizontalPlacementResolver } from '@tscaps/engine/advanced';

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
    animationCssBuilder: ElementAnimationCssBuilder,
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
    this.register(new ProjectV19ToV20Migration());
    this.register(new ProjectV20ToV21Migration());
    this.register(new ProjectV21ToV22Migration());
    this.register(new ProjectV22ToV23Migration(animationCssWriter));
    this.register(new ProjectV23ToV24Migration(styledElementCatalog, controlCssWriter));
    this.register(new ProjectV24ToV25Migration());
    this.register(new ProjectV25ToV26Migration());
    this.register(new ProjectV26ToV27Migration());
    this.register(new ProjectV27ToV28Migration(animationCssBuilder));
    this.register(new ProjectV28ToV29Migration());
    this.register(new ProjectV29ToV30Migration());
    this.register(new ProjectV30ToV31Migration());
    this.register(new ProjectV31ToV32Migration());
    this.register(new ProjectV32ToV33Migration());
    this.register(new ProjectV33ToV34Migration());
    this.register(new ProjectV34ToV35Migration());
    this.register(new ProjectV35ToV36Migration());
    this.register(new ProjectV36ToV37Migration());
    this.register(new ProjectV37ToV38Migration());
    this.register(new ProjectV38ToV39Migration());
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
