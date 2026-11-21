import type { AgentHelpArticle } from '@core/help/domain/AgentHelpArticle';
import type { AgentHelpSource } from '@core/help/domain/AgentHelpSource';
import type { KeyChord } from '@core/shortcuts/domain/KeyChord';
import type { ShortcutCategory } from '@core/shortcuts/domain/ShortcutCategory';
import { SHORTCUT_CATEGORIES } from '@core/shortcuts/domain/ShortcutCategory';
import type { ShortcutCatalog } from '@core/shortcuts/services/ShortcutCatalog';
import type { KeymapStore } from '@core/shortcuts/store/KeymapStore';

const CATEGORY_HEADINGS: Readonly<Record<ShortcutCategory, string>> = {
  general: 'General shortcuts',
  playback: 'Playback shortcuts',
  transcript: 'Transcript shortcuts',
  timeline: 'Timeline shortcuts',
};

const KEY_NAMES: Readonly<Record<string, string>> = {
  space: 'Space',
  enter: 'Enter',
  escape: 'Esc',
  backspace: 'Backspace',
  delete: 'Delete',
  tab: 'Tab',
  plus: '+',
  arrowleft: 'Left arrow',
  arrowright: 'Right arrow',
  arrowup: 'Up arrow',
  arrowdown: 'Down arrow',
  home: 'Home',
  end: 'End',
  pageup: 'Page Up',
  pagedown: 'Page Down',
};

/**
 * The keyboard shortcuts article, written from the keymap in force when
 * it is read: the person's own changes included, and every command the
 * app has, so it is never behind the app.
 */
export class ShortcutsAgentHelpSource implements AgentHelpSource {
  constructor(
    private readonly catalog: ShortcutCatalog,
    private readonly keymapStore: KeymapStore,
  ) {}

  articles(): ReadonlyArray<AgentHelpArticle> {
    const sections = SHORTCUT_CATEGORIES.map((category) => this.sectionOf(category)).filter((section) => section !== '');
    const body = [
      'Every shortcut can be changed in the **Keyboard shortcuts** dialog: press ? or click the keyboard icon in the editor toolbar. '
        + 'The keys below are the ones in force on this browser, the person\'s own changes included. '
        + 'Ctrl/⌘ means Ctrl on Windows and Linux, ⌘ on a Mac.',
      ...sections,
    ].join('\n\n');
    return [{
      id: 'shortcuts',
      title: 'Keyboard shortcuts',
      keywords: ['keyboard', 'shortcut', 'hotkey', 'keys', 'keybinding', 'rebind', 'key combination', 'faster'],
      body,
    }];
  }

  private sectionOf(category: ShortcutCategory): string {
    const lines = this.catalog.listCategory(category).map((command) => {
      const chords = this.keymapStore.keymap.chordsFor(command.id);
      const keys = chords.length === 0 ? 'no key set' : chords.map((chord) => this.labelOf(chord)).join(' or ');
      const hint = command.hint === undefined ? '' : ` (${command.hint})`;
      return `- ${command.title}: ${keys}${hint}`;
    });
    if (lines.length === 0) return '';
    return `## ${CATEGORY_HEADINGS[category]}\n${lines.join('\n')}`;
  }

  private labelOf(chord: KeyChord): string {
    const keys: string[] = [];
    if (chord.primary) keys.push('Ctrl/⌘');
    if (chord.alt) keys.push('Alt/⌥');
    if (chord.shift) keys.push('Shift');
    keys.push(KEY_NAMES[chord.key] ?? chord.key.toUpperCase());
    return keys.join('+');
  }
}
