import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v29 → v30: a shot layer may hold a `graphic` — its document, its
 * fields, the values set on them and the shape of its box — in place of
 * a file. A v29 shot holds none, so the step only advances the version:
 * what it buys is that a build still on v29, whose check drops a layer
 * naming no file, refuses a v30 project instead of saving it without
 * its graphics.
 */
export class ProjectV29ToV30Migration implements ProjectMigration {
  readonly fromVersion = 29;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
