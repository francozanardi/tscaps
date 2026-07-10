import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';
import { EMOJI_GAP_DEFAULT } from '@core/effect/domain/EffectConfig';

/**
 * v7 → v8: backfills the `gap` multiplier on every persisted emoji
 * effect config. Projects saved before the field existed pick up the
 * neutral default so the rendered glyph keeps its prior distance from
 * its anchor.
 */
export class ProjectV7ToV8Migration implements ProjectMigration {
  readonly fromVersion = 7;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    const sheets = Array.isArray(data.sheets) ? data.sheets : [];
    return {
      ...data,
      sheets: sheets.map((sheet) => this.backfillSheetEmojiGap(sheet)),
    };
  }

  private backfillSheetEmojiGap(sheet: unknown): Record<string, unknown> {
    const source = (sheet ?? {}) as Record<string, unknown>;
    const effectConfigs = source.effectConfigs;
    if (!Array.isArray(effectConfigs)) return source;
    return {
      ...source,
      effectConfigs: effectConfigs.map((config) => this.backfillEmojiGap(config)),
    };
  }

  private backfillEmojiGap(config: unknown): unknown {
    if (!config || typeof config !== 'object') return config;
    const record = config as Record<string, unknown>;
    if (record.type !== 'emoji') return record;
    if (typeof record.gap === 'number') return record;
    return { ...record, gap: EMOJI_GAP_DEFAULT };
  }
}
