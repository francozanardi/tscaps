import { KeyChord } from '@core/shortcuts/domain/KeyChord';

/** Keys that only ever modify another key; pressed alone they are not a chord. */
const MODIFIER_KEYS = new Set([
  'control', 'meta', 'shift', 'alt', 'altgraph', 'capslock', 'fn', 'fnlock',
  'os', 'hyper', 'super', 'numlock', 'scrolllock', 'symbol', 'symbollock',
]);

/** Values of `key` that name no key at all; the physical key is all there is to go on. */
const UNNAMED_KEYS = new Set(['dead', 'unidentified', 'process']);

/** The character each physical punctuation key carries on a US layout. */
const PUNCTUATION_BY_CODE: Readonly<Record<string, string>> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: '\'',
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
};

const LETTER_CODE = /^Key([A-Z])$/;
const DIGIT_CODE = /^Digit(\d)$/;

/**
 * Turns a keydown into the chord it presses, the same way whether the
 * chord is being fired or recorded, so a chord recorded once always
 * matches the press that recorded it.
 *
 * The key is read as typed, so Ctrl+Z means the key labelled Z on any
 * layout. Two cases read the physical key instead: Alt, because on a Mac
 * Alt turns the letter into another character (Alt+K types `˚`), and a
 * dead or unnamed key. Shift is dropped from a symbol it was needed to
 * type: `?` is `?`, whatever the layout puts it under.
 */
export class KeyChordReader {

  /** The chord, or `null` for a press that is not one: a lone modifier, or an event with no key. */
  read(event: KeyboardEvent): KeyChord | null {
    // Chromium's autofill dropdown dispatches keydowns with no `key`,
    // whatever the DOM type says.
    const rawKey: unknown = event.key;
    if (typeof rawKey !== 'string' || rawKey === '') return null;
    if (MODIFIER_KEYS.has(rawKey.toLowerCase())) return null;
    const physicalKey = this.physicalKey(event.code);
    const readsPhysical = UNNAMED_KEYS.has(rawKey.toLowerCase()) || (event.altKey && physicalKey !== null);
    const key = readsPhysical ? physicalKey : this.typedKey(rawKey);
    if (key === null) return null;
    const shift = event.shiftKey && (readsPhysical || !this.isShiftedSymbol(rawKey));
    return new KeyChord(key, event.ctrlKey || event.metaKey, shift, event.altKey);
  }

  private typedKey(rawKey: string): string {
    if (rawKey === ' ') return 'space';
    if (rawKey === '+') return 'plus';
    return rawKey.toLowerCase();
  }

  private physicalKey(code: string | undefined): string | null {
    if (!code) return null;
    const letter = LETTER_CODE.exec(code);
    if (letter) return letter[1]!.toLowerCase();
    const digit = DIGIT_CODE.exec(code);
    if (digit) return digit[1]!;
    return PUNCTUATION_BY_CODE[code] ?? null;
  }

  /**
   * A single character with no case and no digit value, which Shift may
   * have been needed to type. Letters keep Shift: Shift+Z is its own chord.
   */
  private isShiftedSymbol(rawKey: string): boolean {
    if (rawKey.length !== 1 || rawKey === ' ') return false;
    if (/\d/.test(rawKey)) return false;
    return rawKey.toLowerCase() === rawKey.toUpperCase();
  }
}
