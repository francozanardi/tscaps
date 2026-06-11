import type { ProjectMigration } from '@core/projects/services/ProjectMigration';

/**
 * v4 → v5: drops the top-level `mode` field from the serialized payload.
 * The load path always overrides it from a more authoritative source,
 * so keeping the in-payload copy invited hand-edited files to disagree
 * with reality. v5 removes the field so the load path is the only
 * source of truth.
 */
export class ProjectV4ToV5Migration implements ProjectMigration {
  readonly fromVersion = 4;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    const next = { ...data };
    delete next.mode;
    return next;
  }
}
