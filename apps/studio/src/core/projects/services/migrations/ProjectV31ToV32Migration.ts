import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v31 → v32: a graphic keeps the id of the preset it started from
 * (`presetId`), so a reset can go back to it once its code is edited. A
 * v31 graphic kept none, and its absence reads as none (the editor then
 * knows it by its code while that is still a preset's), so the step only
 * advances the version: what it buys is that a build still on v31, which
 * drops the field, refuses a v32 project instead of saving it without it.
 */
export class ProjectV31ToV32Migration implements ProjectMigration {
  readonly fromVersion = 31;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
