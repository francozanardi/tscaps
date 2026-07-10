import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v2 → v3: introduces the per-project `mode` field on the top-level
 * project record. v2 had no notion of "where did transcription run" baked
 * into the project — that lived as sidecar metadata. v3 makes it part of
 * the project itself; old projects whose mode is unknown default to
 * `local` because that's the only path v2 guaranteed worked end-to-end.
 */
export class ProjectV2ToV3Migration implements ProjectMigration {
  readonly fromVersion = 2;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data, mode: typeof data.mode === 'string' ? data.mode : 'local' };
  }
}
