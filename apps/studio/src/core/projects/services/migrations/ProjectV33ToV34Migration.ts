import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v33 → v34: a word read from a caption file carries the cue it came
 * from (`cueIndex`), and sheets gain the `cue_change` splitter that keeps
 * cues apart. A v33 word came from no cue as far as anyone can tell now,
 * and the field's absence reads as none; a v33 sheet without the
 * splitter has nothing it could cut. So the step only advances the
 * version: what it buys is that a build still on v33, which drops the
 * field, refuses a v34 project instead of saving it without it.
 */
export class ProjectV33ToV34Migration implements ProjectMigration {
  readonly fromVersion = 33;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data };
  }
}
