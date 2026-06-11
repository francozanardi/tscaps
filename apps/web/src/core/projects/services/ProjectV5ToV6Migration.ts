import type { ProjectMigration } from '@core/projects/services/ProjectMigration';

const RENAMED_BUILTIN_TEMPLATE_IDS: ReadonlyMap<string, string> = new Map([
  ['lite', 'mira'],
  ['print', 'cleo'],
  ['glow', 'noor'],
  ['wave', 'tito'],
  ['ide', 'pico'],
  ['mark', 'pepper'],
  ['brush', 'iris'],
  ['beast', 'loki'],
  ['broadcast', 'otto'],
  ['karaoke', 'theo'],
  ['focus', 'vera'],
  ['code', 'kel'],
  ['minimal', 'yuki'],
  ['hype', 'naya'],
  ['reveal', 'elio'],
  ['elegant', 'anya'],
  ['high', 'juno'],
  ['vibrant', 'zara'],
  ['sticker', 'tala'],
  ['snap', 'remi'],
  ['tape', 'ivo'],
  ['cascade', 'levi'],
  ['terminal', 'nyx'],
  ['bubble', 'lena'],
  ['holo', 'lyra'],
  ['glitch', 'freya'],
  ['chroma', 'kai'],
  ['pulse', 'luna'],
  ['frost', 'selene'],
]);

/**
 * v5 → v6: rewrites every sheet's `templateId` from its pre-rename
 * built-in id to the current id. Ids not in the rename table pass
 * through unchanged so user-saved template ids stay intact.
 */
export class ProjectV5ToV6Migration implements ProjectMigration {
  readonly fromVersion = 5;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    const sheets = Array.isArray(data.sheets) ? data.sheets : [];
    return {
      ...data,
      sheets: sheets.map((sheet) => this.renameSheetTemplateId(sheet)),
    };
  }

  private renameSheetTemplateId(sheet: unknown): Record<string, unknown> {
    const source = (sheet ?? {}) as Record<string, unknown>;
    const templateId = source.templateId;
    if (typeof templateId !== 'string') return source;
    const renamed = RENAMED_BUILTIN_TEMPLATE_IDS.get(templateId) ?? templateId;
    return { ...source, templateId: renamed };
  }
}
