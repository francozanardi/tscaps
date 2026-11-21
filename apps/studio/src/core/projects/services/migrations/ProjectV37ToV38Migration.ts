import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v37 → v38: a project keeps the person's review notes (`reviewNotes`).
 * A v37 project had none, which is how a project with no such field
 * still reads. So the step only advances the version: what it buys is
 * that a build still on v37, which drops the field, refuses a v38
 * project instead of saving it without its notes.
 */
export class ProjectV37ToV38Migration implements ProjectMigration {
  readonly fromVersion = 37;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
