const SERIALIZED_SEPARATOR = '+';
const PRIMARY_TOKEN = 'mod';
const ALT_TOKEN = 'alt';
const SHIFT_TOKEN = 'shift';
const FUNCTION_KEY = /^f\d{1,2}$/;

/**
 * Keys a browser keeps for itself when held with the primary modifier:
 * the page never receives them, so binding one would be a shortcut that
 * silently never fires.
 */
const BROWSER_RESERVED_PRIMARY_KEYS = new Set(['w', 't', 'n', 'q', 'tab']);

/**
 * One key pressed with a set of modifiers, in the canonical form every
 * part of the shortcuts feature speaks.
 *
 * `key` is a lowercase name: a printable character as typed (`'z'`, `'/'`,
 * `'?'`), or a named key (`'space'`, `'enter'`, `'arrowup'`, `'f5'`,
 * `'plus'` for `+`, so the serialized form never needs escaping).
 * `primary` is the cross-platform primary modifier: Cmd on Apple
 * platforms, Ctrl everywhere else. A chord never distinguishes the two,
 * so one keymap works on both.
 *
 * Immutable; compare with `equals`, never by reference.
 */
export class KeyChord {

  constructor(
    readonly key: string,
    readonly primary: boolean = false,
    readonly shift: boolean = false,
    readonly alt: boolean = false,
  ) {}

  /**
   * Reads a chord back from `serialize`'s output. Answers `null` for
   * anything that is not one — an empty key, an unknown modifier, a
   * modifier repeated — so a corrupted stored value never becomes a
   * binding nobody can see.
   */
  static parse(serialized: string): KeyChord | null {
    const tokens = serialized.split(SERIALIZED_SEPARATOR);
    const key = tokens.pop();
    if (!key) return null;
    const modifiers = new Set(tokens);
    if (modifiers.size !== tokens.length) return null;
    for (const modifier of modifiers) {
      if (modifier !== PRIMARY_TOKEN && modifier !== ALT_TOKEN && modifier !== SHIFT_TOKEN) return null;
    }
    return new KeyChord(key, modifiers.has(PRIMARY_TOKEN), modifiers.has(SHIFT_TOKEN), modifiers.has(ALT_TOKEN));
  }

  /** Stable text form, e.g. `mod+shift+z`. Modifiers always come in the same order. */
  serialize(): string {
    const tokens: string[] = [];
    if (this.primary) tokens.push(PRIMARY_TOKEN);
    if (this.alt) tokens.push(ALT_TOKEN);
    if (this.shift) tokens.push(SHIFT_TOKEN);
    tokens.push(this.key);
    return tokens.join(SERIALIZED_SEPARATOR);
  }

  equals(other: KeyChord): boolean {
    return this.key === other.key
      && this.primary === other.primary
      && this.shift === other.shift
      && this.alt === other.alt;
  }

  /**
   * Whether pressing this chord inside a text field can mean something
   * other than typing. A chord with Ctrl/Cmd or Alt, a function key and
   * Escape qualify; a bare letter, Space, an arrow or Enter is text
   * editing, so it never reaches a shortcut while the user types.
   */
  worksWhileTyping(): boolean {
    if (this.primary || this.alt) return true;
    return this.key === 'escape' || FUNCTION_KEY.test(this.key);
  }

  /**
   * Whether the browser swallows this chord before the page sees it (new
   * tab, close the tab, quit), or it is the keyboard's way of moving
   * focus. Either way it cannot be a shortcut here.
   */
  isReservedByBrowser(): boolean {
    if (this.key === 'tab' && !this.alt) return true;
    return this.primary && !this.alt && BROWSER_RESERVED_PRIMARY_KEYS.has(this.key);
  }
}
