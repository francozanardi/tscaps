import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v9 → v10: seeds `cuts: []` on projects saved before the Cuts mode
 * existed. The new field is optional on the wire — the serializer
 * omits it when empty — so the migration only needs to be defensive
 * about the field's absence.
 */
export class ProjectV9ToV10Migration implements ProjectMigration {
  readonly fromVersion = 9;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data, cuts: Array.isArray(data.cuts) ? data.cuts : [] };
  }
}
