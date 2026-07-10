import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';
import {
  EMOJI_GAP_DEFAULT,
  EMOJI_PLACEMENT_DEFAULT,
  EMOJI_SIZE_DEFAULT,
} from '@core/effect/domain/EffectConfig';

/**
 * v8 → v9: appends a default emoji effect config to any sheet whose
 * effect list pre-dates the emoji effect's introduction. Sheets that
 * already carry an emoji entry pass through unchanged. Restores the
 * invariant that every registered effect has an entry on every sheet.
 */
export class ProjectV8ToV9Migration implements ProjectMigration {
  readonly fromVersion = 8;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    const sheets = Array.isArray(data.sheets) ? data.sheets : [];
    return {
      ...data,
      sheets: sheets.map((sheet) => this.ensureEmojiEntry(sheet)),
    };
  }

  private ensureEmojiEntry(sheet: unknown): Record<string, unknown> {
    const source = (sheet ?? {}) as Record<string, unknown>;
    const effectConfigs = source.effectConfigs;
    if (!Array.isArray(effectConfigs)) return source;
    if (effectConfigs.some((c) => this.isEmojiConfig(c))) return source;
    return {
      ...source,
      effectConfigs: [...effectConfigs, this.defaultEmojiConfig()],
    };
  }

  private isEmojiConfig(config: unknown): boolean {
    if (!config || typeof config !== 'object') return false;
    return (config as Record<string, unknown>).type === 'emoji';
  }

  private defaultEmojiConfig(): Record<string, unknown> {
    return {
      type: 'emoji',
      enabled: false,
      placement: EMOJI_PLACEMENT_DEFAULT,
      size: EMOJI_SIZE_DEFAULT,
      gap: EMOJI_GAP_DEFAULT,
    };
  }
}
