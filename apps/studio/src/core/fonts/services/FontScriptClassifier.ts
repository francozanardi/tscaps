import type { FontFaceSlot, FontScript } from '@core/fonts/domain/FontScript';

// `Script_Extensions` so the letters Persian and Urdu add to the Arabic
// script count with it.
const ARABIC = /\p{Script_Extensions=Arabic}/u;
const HEBREW = /\p{Script=Hebrew}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;
const GREEK = /\p{Script=Greek}/u;
const DEVANAGARI = /\p{Script=Devanagari}/u;
const BENGALI = /\p{Script=Bengali}/u;
const TELUGU = /\p{Script=Telugu}/u;
const TAMIL = /\p{Script=Tamil}/u;
const THAI = /\p{Script=Thai}/u;
const LATIN = /\p{Script=Latin}/u;

// Tried in this order, and a character counts for the first script that
// claims it. Latin sits last because Arabic's script extensions reach into
// characters the earlier entries should win.
const PATTERNS: ReadonlyArray<readonly [FontScript, RegExp]> = [
  ['arabic', ARABIC],
  ['hebrew', HEBREW],
  ['devanagari', DEVANAGARI],
  ['bengali', BENGALI],
  ['telugu', TELUGU],
  ['tamil', TAMIL],
  ['thai', THAI],
  ['cyrillic', CYRILLIC],
  ['greek', GREEK],
  ['latin', LATIN],
];

// A tie resolves in this order, Latin first: mis-leading a stack toward Latin
// keeps today's behaviour, while mis-leading it away from Latin changes the
// metrics of every caption on the sheet.
const TIE_ORDER: readonly FontFaceSlot[] = [
  'latin', 'arabic', 'hebrew', 'cyrillic', 'greek', 'devanagari',
  'bengali', 'telugu', 'tamil', 'thai', 'other',
];

// Letters Urdu adds to the Arabic script and Persian does not use, so their
// presence separates the two without misreading Persian as Urdu. Deliberately
// conservative: Urdu text that happens to avoid all of them classifies as
// plain Arabic and gets the Arabic face instead of the Nastaliq one.
const URDU_MARKERS = /[ٹڈڑںہے]/u;

/**
 * Decides which of the catalog's faces a text should be drawn with, by
 * simple majority of its letters. Punctuation, digits and whitespace carry
 * no script and do not vote.
 *
 * Returns `null` when no letter belongs to a script the catalog ships a
 * face for — the caller keeps the chosen family in that case, because
 * there is no better-informed face to offer.
 */
export class FontScriptClassifier {

  /**
   * Writing system of `text`. Never `'urdu'`: Urdu is written in the Arabic
   * script, so no amount of looking at letters separates the two — only the
   * language does, and a short text does not carry it.
   */
  classify(text: string): FontScript | null {
    return this.scriptsByUse(text)[0] ?? null;
  }

  /**
   * Every script `text` holds a letter of, the one it holds most of
   * first. What a control offering a face per writing system is ordered
   * by, and what decides which of them it leads with.
   *
   * Never reports `'urdu'`, for the same reason `classify` does not.
   */
  scriptsByUse(text: string): FontScript[] {
    const counts = this.count(text);
    const scripts = [...counts.keys()].filter((slot): slot is FontScript => slot !== 'other');
    return scripts.sort((a, b) => this.compareUse(counts, a, b));
  }

  /** Managed scripts plus one shared Other slot, ordered by how many letters each holds. */
  fontFaceSlotsByUse(text: string): FontFaceSlot[] {
    const counts = this.count(text);
    return [...counts.keys()].sort((a, b) => this.compareUse(counts, a, b));
  }

  /**
   * Every script the catalog ships a face for that `text` holds at least
   * one letter of. Presence, where `scriptsByUse` also orders: this one
   * says which faces could be called on to draw something.
   *
   * Never reports `'urdu'`, for the same reason `classify` does not — the
   * letters do not separate it from the rest of the Arabic script, so
   * Urdu text reports `'arabic'`.
   */
  scriptsIn(text: string): Set<FontScript> {
    return new Set([...this.count(text).keys()].filter((slot): slot is FontScript => slot !== 'other'));
  }

  /** Unsupported letter code points the compiled family must leave to the explicit Other face. */
  otherLetterCodepoints(text: string): Set<number> {
    const points = new Set<number>();
    for (const character of text) {
      if (!/\p{Letter}/u.test(character)) continue;
      if (PATTERNS.some(([, pattern]) => pattern.test(character))) continue;
      points.add(character.codePointAt(0)!);
    }
    return points;
  }

  /**
   * Same, refined with the language the text is written in, which tells
   * Urdu apart from the rest of the Arabic script and earns it the Nastaliq
   * face.
   *
   * Only sound over a whole body of captions: the letters that mark Urdu
   * appear in some of its words and not others, so asking this of a single
   * word would answer Urdu for some words of a sentence and Arabic for the
   * rest, and paint one line in two unrelated styles.
   */
  classifyWithLanguage(text: string): FontScript | null {
    const script = this.classify(text);
    if (script !== 'arabic') return script;
    return URDU_MARKERS.test(text) ? 'urdu' : script;
  }

  /** Conservative language hint over all captions, independent of which script dominates. */
  readsAsUrdu(text: string): boolean {
    return URDU_MARKERS.test(text);
  }

  /** How many of the text's letters each script claims. Scripts with none are absent. */
  private count(text: string): Map<FontFaceSlot, number> {
    const counts = new Map<FontFaceSlot, number>();
    for (const character of text) {
      if (!/\p{Letter}/u.test(character)) continue;
      const slot = PATTERNS.find(([, pattern]) => pattern.test(character))?.[0] ?? 'other';
      counts.set(slot, (counts.get(slot) ?? 0) + 1);
    }
    return counts;
  }

  private compareUse(counts: ReadonlyMap<FontFaceSlot, number>, a: FontFaceSlot, b: FontFaceSlot): number {
    const byCount = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    return byCount !== 0 ? byCount : TIE_ORDER.indexOf(a) - TIE_ORDER.indexOf(b);
  }
}
