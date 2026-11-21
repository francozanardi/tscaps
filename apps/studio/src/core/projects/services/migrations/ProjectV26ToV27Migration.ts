import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v26 → v27: the soundtrack may name `footageSounds`, the shot layers
 * whose file's own sound is heard, and `shotVideoVolumes`, the shots
 * that play the video's own sound at a level of their own. A v26
 * soundtrack has neither, which reads as every layer silent and every
 * shot at the video's level, so the step only
 * advances the version: what it buys is that a build still on v26
 * refuses a v27 project instead of saving it without them.
 */
export class ProjectV26ToV27Migration implements ProjectMigration {
  readonly fromVersion = 26;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
