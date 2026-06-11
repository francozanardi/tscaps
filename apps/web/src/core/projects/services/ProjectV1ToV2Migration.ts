import type { ProjectMigration } from '@core/projects/services/ProjectMigration';

/**
 * v1 → v2: collapses the per-sheet `segmentSplitterConfig` (singular) into
 * the new `segmentSplitterConfigs` array. v1 sheets only ever stored the
 * single editable splitter (`limit_by_chars` / `limit_by_words`); the
 * boundary stage was inherited from `template.boundarySplitter` at derive
 * time and was never persisted on the sheet. v2 makes the whole pipeline
 * sheet-owned, so the migration prepends a default-mode boundary entry to
 * preserve the v1 default behaviour.
 *
 * Sheets that inherited a non-default boundary mode (e.g., `clause` from
 * the `corner` / `high` templates) silently fall back to `sentence` after
 * migration; re-applying the template restores the template's pipeline.
 */
export class ProjectV1ToV2Migration implements ProjectMigration {
  readonly fromVersion = 1;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    const sheets = Array.isArray(data.sheets) ? data.sheets : [];
    return {
      ...data,
      sheets: sheets.map((s) => this.migrateSheet(s as Record<string, unknown>)),
    };
  }

  private migrateSheet(sheet: Record<string, unknown>): Record<string, unknown> {
    const { segmentSplitterConfig, ...rest } = sheet;
    const segmentSplitterConfigs = [
      { type: 'boundary', mode: 'sentence' },
      ...(segmentSplitterConfig ? [segmentSplitterConfig] : []),
    ];
    return { ...rest, segmentSplitterConfigs };
  }
}
