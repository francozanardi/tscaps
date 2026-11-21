import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v36 → v37: a shot's own video can follow a person (`follow` on the
 * shot: where their head was, frame by frame, and the shape of the
 * picture). Nothing in a v36 project did, which is how a shot with no
 * such field still reads. So the step only advances the version: what
 * it buys is that a build still on v36, which drops the field, refuses
 * a v37 project instead of saving it with every camera that follows
 * someone back to a fixed one.
 */
export class ProjectV36ToV37Migration implements ProjectMigration {
  readonly fromVersion = 36;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
