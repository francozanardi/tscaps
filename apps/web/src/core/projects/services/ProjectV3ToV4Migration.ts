import type { ProjectMigration } from '@core/projects/services/ProjectMigration';

/**
 * v3 → v4: introduces the per-sheet `filtersSvgOverride` field, mirroring
 * the existing `cssOverride`. Pre-v4 projects had no notion of a
 * per-sheet `filters.svg` edit, so every sheet is initialised to `null`
 * (render with the template's pristine filters).
 */
export class ProjectV3ToV4Migration implements ProjectMigration {
  readonly fromVersion = 3;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    const sheets = Array.isArray(data.sheets) ? data.sheets : [];
    return {
      ...data,
      sheets: sheets.map((sheet) => this.addFiltersSvgOverride(sheet)),
    };
  }

  private addFiltersSvgOverride(sheet: unknown): Record<string, unknown> {
    const source = (sheet ?? {}) as Record<string, unknown>;
    return { ...source, filtersSvgOverride: null };
  }
}
