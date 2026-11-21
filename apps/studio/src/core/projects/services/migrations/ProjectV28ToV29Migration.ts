import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v28 → v29: a project may carry `pictureChanges`, where its video's
 * picture changes abruptly, which the shot proposal cuts on. A v28
 * project has none, which reads as nobody having looked, so the step
 * only advances the version: what it buys is that a build still on v28
 * refuses a v29 project instead of saving it without them.
 */
export class ProjectV28ToV29Migration implements ProjectMigration {
  readonly fromVersion = 28;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
