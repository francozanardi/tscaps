import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v35 → v36: a shot layer can show through a later shot
 * (`throughShotId`), and so can a shot's own video, with its camera and
 * framing (`videoThroughShotId`). Nothing in a v35 project did: each
 * ended with its own shot, which is how one naming no such shot still
 * reads. So the step only advances the version: what it buys is that a
 * build still on v35, which drops both fields, refuses a v36 project
 * instead of saving it with every layer and camera cut back to its own
 * shot.
 */
export class ProjectV35ToV36Migration implements ProjectMigration {
  readonly fromVersion = 35;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
