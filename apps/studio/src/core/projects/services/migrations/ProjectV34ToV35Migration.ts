import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v34 → v35: a sound can be placed on an emoji (`anchor.kind: 'emoji'`),
 * playing only while the captions show it. No v34 sound was, so the step
 * only advances the version: what it buys is that a build still on v34,
 * which drops a sound on an anchor it does not know, refuses a v35
 * project instead of saving it without its sounds on emojis.
 */
export class ProjectV34ToV35Migration implements ProjectMigration {
  readonly fromVersion = 34;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
