import { SHORTCUT_CATEGORIES, type ShortcutCategory } from '@core/shortcuts/domain/ShortcutCategory';
import type { Keymap } from '@core/shortcuts/domain/Keymap';
import type { ShortcutCommand } from '@core/shortcuts/domain/ShortcutCommand';
import type { ShortcutCatalog } from '@core/shortcuts/services/ShortcutCatalog';
import type { KeyChordLabeler } from '@presentation/shortcuts/services/KeyChordLabeler';

const CATEGORY_TITLES: Readonly<Record<ShortcutCategory, string>> = {
  general: 'General',
  playback: 'Playback',
  transcript: 'Transcript',
  timeline: 'Timeline',
};

export interface ShortcutListSection {
  readonly category: ShortcutCategory;
  readonly title: string;
  readonly commands: readonly ShortcutCommand[];
}

/**
 * Lays the catalog out as the shortcuts list shows it: one section per
 * category, in order, holding the commands that match a filter. A
 * command matches when the filter appears in its name, its hint, or the
 * label of any chord it answers to, ignoring case, so typing `ctrl` or
 * `⌘` finds every command bound with it. Sections left empty are dropped.
 */
export class ShortcutListBuilder {

  constructor(
    private readonly catalog: ShortcutCatalog,
    private readonly labeler: KeyChordLabeler,
  ) {}

  build(keymap: Keymap, filter: string): ShortcutListSection[] {
    const needle = filter.trim().toLowerCase();
    return SHORTCUT_CATEGORIES
      .map((category) => ({
        category,
        title: CATEGORY_TITLES[category],
        commands: this.catalog.listCategory(category).filter((command) => this.matches(command, keymap, needle)),
      }))
      .filter((section) => section.commands.length > 0);
  }

  private matches(command: ShortcutCommand, keymap: Keymap, needle: string): boolean {
    if (needle === '') return true;
    const haystacks = [
      command.title,
      command.hint ?? '',
      ...keymap.chordsFor(command.id).map((chord) => this.labeler.label(chord)),
    ];
    return haystacks.some((haystack) => haystack.toLowerCase().includes(needle));
  }
}
