import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';
import { EMOJI_SIZE_DEFAULT } from '@core/effect/domain/EffectConfig';

/**
 * v6 → v7: backfills the `size` multiplier on every persisted emoji
 * effect config. Projects saved before the field existed had no value;
 * they pick up the historical default so the user does not see the
 * decoration glyph suddenly miss its scale on first load.
 */
export class ProjectV6ToV7Migration implements ProjectMigration {
  readonly fromVersion = 6;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    const sheets = Array.isArray(data.sheets) ? data.sheets : [];
    return {
      ...data,
      sheets: sheets.map((sheet) => this.backfillSheetEmojiSize(sheet)),
    };
  }

  private backfillSheetEmojiSize(sheet: unknown): Record<string, unknown> {
    const source = (sheet ?? {}) as Record<string, unknown>;
    const effectConfigs = source.effectConfigs;
    if (!Array.isArray(effectConfigs)) return source;
    return {
      ...source,
      effectConfigs: effectConfigs.map((config) => this.backfillEmojiSize(config)),
    };
  }

  private backfillEmojiSize(config: unknown): unknown {
    if (!config || typeof config !== 'object') return config;
    const record = config as Record<string, unknown>;
    if (record.type !== 'emoji') return record;
    if (typeof record.size === 'number') return record;
    return { ...record, size: EMOJI_SIZE_DEFAULT };
  }
}
