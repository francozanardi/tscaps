import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v30 → v31: a graphic keeps the moments its code declared (`moments`:
 * id, label and second), and a sound may be placed on one of them. A v30
 * graphic declared none, and its absence reads as none, so the step only
 * advances the version: what it buys is that a build still on v30, which
 * drops both, refuses a v31 project instead of saving it without them.
 */
export class ProjectV30ToV31Migration implements ProjectMigration {
  readonly fromVersion = 30;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
