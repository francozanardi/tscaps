// Words that carry no meaning for a search over help text.
const STOP_WORDS = new Set([
  'a', 'about', 'after', 'all', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for',
  'from', 'get', 'have', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'one', 'or',
  'so', 'that', 'the', 'their', 'them', 'then', 'there', 'this', 'to', 'up', 'was', 'what', 'when', 'where',
  'which', 'while', 'who', 'why', 'will', 'with', 'you', 'your',
]);

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/**
 * Turns English text into the terms a help search compares: lowercase,
 * accents dropped, stop words left out, and each word cut to a rough stem
 * so that *cut*, *cuts* and *cutting*, or *style*, *styles* and *styling*,
 * meet. The stemming is crude and only has to be consistent: a query and
 * an article go through the same cuts.
 */
export class AgentHelpTokenizer {
  terms(text: string): string[] {
    return text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word !== '' && !STOP_WORDS.has(word))
      .map((word) => this.stem(word));
  }

  private stem(word: string): string {
    if (word.length <= 3 || /^[0-9]+$/.test(word)) return word;
    let stem = this.withoutPlural(word);
    stem = this.withoutVerbEnding(stem);
    if (stem.length > 3 && stem.endsWith('e')) stem = stem.slice(0, -1);
    return stem;
  }

  private withoutPlural(word: string): string {
    if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
    if (word.endsWith('sses')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && !word.endsWith('is')) return word.slice(0, -1);
    return word;
  }

  private withoutVerbEnding(word: string): string {
    for (const ending of ['ing', 'ed']) {
      if (word.endsWith(ending) && word.length - ending.length >= 3) {
        return this.withoutDoubledConsonant(word.slice(0, -ending.length));
      }
    }
    return word;
  }

  /** `cutt` (from *cutting*) back to `cut`; `fill` and `pass` keep theirs. */
  private withoutDoubledConsonant(stem: string): string {
    const last = stem[stem.length - 1];
    if (last === undefined || last !== stem[stem.length - 2] || VOWELS.has(last)) return stem;
    if (last === 'l' || last === 's' || last === 'z') return stem;
    return stem.slice(0, -1);
  }
}
