import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v24 → v25: a project may carry a soundtrack, `audio` — the video's
 * own level and the sound effects and music mixed over it. A v24
 * project has none, which reads as the empty mix, so the step only
 * advances the version: what it buys is that a build still on v24
 * refuses a v25 project instead of saving it without its sounds.
 */
export class ProjectV24ToV25Migration implements ProjectMigration {
  readonly fromVersion = 24;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
