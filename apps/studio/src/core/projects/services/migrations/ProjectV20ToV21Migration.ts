import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v20 → v21: the placement a new shot layer starts with is no longer a
 * default set by applying a placement to every layer of a role, but the
 * placement the last edited layer of that role was left with. The shots
 * stored it as `defaultPlacements`; they store it as
 * `lastEditedPlacements` now.
 *
 * The value is carried as stored, so a layer added after the upgrade
 * starts where one added before it did. It is a remembered value either
 * way: no layer follows it, in v20 or now. A role v20 left out was at
 * its fresh placement and stays left out.
 */
export class ProjectV20ToV21Migration implements ProjectMigration {
  readonly fromVersion = 20;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    if (!this.isRecord(data.shots)) return { ...data };
    const { defaultPlacements, ...shots } = data.shots;
    return {
      ...data,
      shots: this.isRecord(defaultPlacements) ? { ...shots, lastEditedPlacements: defaultPlacements } : shots,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
