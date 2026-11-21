import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v38 → v39: a sheet keeps the layout of each of its template's modes
 * beyond the body (`modeLayouts`). A v38 sheet had none, and a sheet with
 * no such field takes its template's layouts, so the step only advances
 * the version: what it buys is that a build still on v38, which drops
 * the field, refuses a v39 project instead of saving it without them.
 */
export class ProjectV38ToV39Migration implements ProjectMigration {
  readonly fromVersion = 38;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
