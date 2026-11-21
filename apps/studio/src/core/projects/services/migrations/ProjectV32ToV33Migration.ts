import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v32 → v33: a graphic can keep the captions off its shot
 * (`hidesCaptions`). A v32 graphic did not, and the field's absence reads
 * as false, so the step only advances the version: what it buys is that a
 * build still on v32, which drops the field, refuses a v33 project instead
 * of saving it without it.
 */
export class ProjectV32ToV33Migration implements ProjectMigration {
  readonly fromVersion = 32;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
