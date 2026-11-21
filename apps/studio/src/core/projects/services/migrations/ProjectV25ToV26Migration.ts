import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v25 → v26: a shot may carry a `transition`, how the picture passes
 * into it from the shot before. A v25 shot has none, which reads as a
 * plain cut, so the step only advances the version: what it buys is
 * that a build still on v25 refuses a v26 project instead of saving it
 * without its transitions.
 */
export class ProjectV25ToV26Migration implements ProjectMigration {
  readonly fromVersion = 25;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
