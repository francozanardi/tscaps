import type { KeyChord } from '@core/shortcuts/domain/KeyChord';

const APPLE_KEY_NAMES: Readonly<Record<string, string>> = {
  enter: '↩',
  backspace: '⌫',
  delete: '⌦',
  escape: 'Esc',
};

const OTHER_KEY_NAMES: Readonly<Record<string, string>> = {
  enter: 'Enter',
  backspace: 'Backspace',
  delete: 'Del',
  escape: 'Esc',
};

const SHARED_KEY_NAMES: Readonly<Record<string, string>> = {
  space: 'Space',
  plus: '+',
  tab: 'Tab',
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  home: 'Home',
  end: 'End',
  pageup: 'Page Up',
  pagedown: 'Page Down',
  insert: 'Ins',
};

/**
 * Names a chord the way the user's keyboard does: ⌥⇧⌘ glyphs on Apple
 * keyboards, Ctrl/Alt/Shift words everywhere else, with modifiers in
 * each platform's usual order.
 */
export class KeyChordLabeler {

  constructor(private readonly appleKeyboard: boolean) {}

  /** One label per key to press, modifiers first, e.g. `['Ctrl', 'Shift', 'Z']`. */
  keys(chord: KeyChord): string[] {
    return [...this.modifierLabels(chord), this.keyLabel(chord.key)];
  }

  /** The whole chord as one string, e.g. `⇧⌘Z` or `Ctrl+Shift+Z`. */
  label(chord: KeyChord): string {
    return this.keys(chord).join(this.appleKeyboard ? '' : '+');
  }

  private modifierLabels(chord: KeyChord): string[] {
    const labels: string[] = [];
    if (this.appleKeyboard) {
      if (chord.alt) labels.push('⌥');
      if (chord.shift) labels.push('⇧');
      if (chord.primary) labels.push('⌘');
      return labels;
    }
    if (chord.primary) labels.push('Ctrl');
    if (chord.alt) labels.push('Alt');
    if (chord.shift) labels.push('Shift');
    return labels;
  }

  private keyLabel(key: string): string {
    const platformName = (this.appleKeyboard ? APPLE_KEY_NAMES : OTHER_KEY_NAMES)[key];
    if (platformName) return platformName;
    const sharedName = SHARED_KEY_NAMES[key];
    if (sharedName) return sharedName;
    return key.toUpperCase();
  }
}
