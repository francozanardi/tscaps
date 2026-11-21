import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SheetReadout, SheetSettingsReadout } from '@core/editor-operations/services/SheetReadout';

const GROUPS = ['effects', 'position', 'typography', 'styleControls'] as const;

/**
 * Says what a template switch undid on a sheet: each setting somebody had
 * moved off the old template's own value (lowercase turned on, the
 * captions moved to the top, a colour changed) that is not what it was
 * any more, as `lowercase on → off`, under the names the assistant's
 * tools take, and the sheet's own CSS and animations where it had them.
 * What only differs because the templates differ (a font, a size) is
 * left out: nobody asked for it, so nothing asked for was lost.
 */
export class TemplateSwitchReadout {
  constructor(private readonly sheets: SheetReadout) {}

  /** What switching `before` to `after` undid, one clause each; empty where the sheet had nothing of its own set. */
  undone(before: Sheet, after: Sheet): string[] {
    const was = this.sheets.settingsOf(before);
    const templateOwn = this.sheets.settingsOf(before.withTemplate(before.template));
    const now = this.sheets.settingsOf(after);
    return [
      ...GROUPS.flatMap((group) => this.undoneIn(group, was, templateOwn, now)),
      ...(before.cssOverride === null ? [] : ['its own CSS']),
      ...(before.animations.isEmpty() ? [] : ['its own animations']),
    ];
  }

  private undoneIn(
    group: (typeof GROUPS)[number],
    was: SheetSettingsReadout,
    templateOwn: SheetSettingsReadout,
    now: SheetSettingsReadout,
  ): string[] {
    const keys = [...new Set([...Object.keys(was[group]), ...Object.keys(templateOwn[group])])];
    return keys
      .filter((key) => was[group][key] !== templateOwn[group][key] && now[group][key] !== was[group][key])
      .map((key) => `${key} ${this.valueText(was[group][key])} → ${this.valueText(now[group][key])}`);
  }

  private valueText(value: unknown): string {
    if (value === undefined) return 'none';
    if (typeof value === 'boolean') return value ? 'on' : 'off';
    return String(value);
  }
}
