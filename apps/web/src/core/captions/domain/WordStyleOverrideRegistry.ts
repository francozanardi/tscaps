import type { AlignmentConfig } from '@tscaps/engine';
import type { WordStyleOverrides } from '@core/captions/domain/WordStyleOverrides';

/**
 * Plain shape of a `WordStyleOverrideRegistry` for serialization. Keys are
 * `Word.id`; only words with at least one override are present.
 */
export type WordStyleOverridesSnapshot = Readonly<Record<string, WordStyleOverrides>>;

const EMPTY: WordStyleOverrides = {};
const EMPTY_CSS: Readonly<Record<string, string>> = {};

/**
 * Per-word style overrides keyed by `Word.id`. Lives entirely web-side: the
 * engine `Document` never carries overrides — they are joined with words at
 * render time (overlay) and at export time (via `SubtitleStyle.wordOverrides`).
 *
 * Immutable. `with()` returns a new instance; passing an empty override
 * record drops the entry so `hasAnyFor()` reflects the global reset accurately.
 */
export class WordStyleOverrideRegistry {
  static empty(): WordStyleOverrideRegistry {
    return new WordStyleOverrideRegistry(new Map(), new Map());
  }

  static fromRecord(record: WordStyleOverridesSnapshot): WordStyleOverrideRegistry {
    return new WordStyleOverrideRegistry(new Map(Object.entries(record)), new Map());
  }

  private constructor(
    private readonly entries: ReadonlyMap<string, WordStyleOverrides>,
    private readonly _cssCache: Map<string, Readonly<Record<string, string>>>,
  ) {}

  get(wordId: string): WordStyleOverrides {
    return this.entries.get(wordId) ?? EMPTY;
  }

  hasAnyFor(wordId: string): boolean {
    const o = this.entries.get(wordId);
    return o !== undefined && Object.keys(o).length > 0;
  }

  isEmpty(): boolean {
    return this.entries.size === 0;
  }

  with(wordId: string, overrides: WordStyleOverrides): WordStyleOverrideRegistry {
    const next = new Map(this.entries);
    if (Object.keys(overrides).length === 0) next.delete(wordId);
    else next.set(wordId, overrides);
    const nextCache = new Map(this._cssCache);
    nextCache.delete(wordId);
    return new WordStyleOverrideRegistry(next, nextCache);
  }

  resetWords(wordIds: Iterable<string>): WordStyleOverrideRegistry {
    let next: Map<string, WordStyleOverrides> | null = null;
    const nextCache = new Map(this._cssCache);
    for (const id of wordIds) {
      if (this.entries.has(id)) {
        next ??= new Map(this.entries);
        next.delete(id);
      }
      nextCache.delete(id);
    }
    if (!next) return this;
    return new WordStyleOverrideRegistry(next, nextCache);
  }

  /**
   * Typography and color overrides for one word, ready to inline onto
   * the word's `<span>`. Only emits keys for fields the user actually
   * overrode, so unset fields fall through to the template's cascade.
   *
   * Position offsets are NOT emitted here — they don't belong on the
   * word's span (which is `inline-block` in line flow). Use
   * `buildAlignmentOverride` to read the structured offsets that the
   * positioned-word anchor consumes.
   *
   * Memoized per-word so `WordView`'s `memo()` sees a stable
   * reference across renders that don't touch this word. `with()`
   * forks the cache and invalidates only the changed entry, so a
   * rapid color drag on one word doesn't force every other overridden
   * word to re-render.
   *
   * `text-decoration` always travels combined: emitting one part would
   * overwrite the other, so the joined value is computed whenever
   * either underline or strikethrough is set.
   */
  buildInlineStyles(wordId: string): Readonly<Record<string, string>> {
    const cached = this._cssCache.get(wordId);
    if (cached !== undefined) return cached;
    const o = this.entries.get(wordId);
    if (!o) {
      this._cssCache.set(wordId, EMPTY_CSS);
      return EMPTY_CSS;
    }
    const css: Record<string, string> = {};
    if (o.fontWeight !== undefined) css['font-weight'] = String(o.fontWeight);
    if (o.italic !== undefined) css['font-style'] = o.italic ? 'italic' : 'normal';
    if (o.underline !== undefined || o.strikethrough !== undefined) {
      const parts: string[] = [];
      if (o.underline) parts.push('underline');
      if (o.strikethrough) parts.push('line-through');
      css['text-decoration'] = parts.length > 0 ? parts.join(' ') : 'none';
    }
    if (o.fontFamily !== undefined) css['font-family'] = `'${o.fontFamily}'`;
    if (o.fontSize !== undefined) css['font-size'] = `${o.fontSize}cqh`;
    if (o.color !== undefined) css.color = o.color;
    if (o.rotation !== undefined) css.rotate = `${o.rotation}deg`;
    this._cssCache.set(wordId, css);
    return css;
  }

  /**
   * Partial alignment override for one word — the anchor and offsets
   * the user has explicitly committed. Merged over the segment's
   * effective alignment by consumers (preview anchor, engine renderer)
   * to derive the word's effective anchor point. Returns `undefined`
   * when the word has no positional override.
   */
  buildAlignmentOverride(wordId: string): Partial<AlignmentConfig> | undefined {
    const o = this.entries.get(wordId);
    if (!o) return undefined;
    const out: Partial<AlignmentConfig> = {};
    if (o.verticalAlign !== undefined) out.verticalAlign = o.verticalAlign;
    if (o.verticalOffset !== undefined) out.verticalOffset = o.verticalOffset;
    if (o.horizontalAlign !== undefined) out.horizontalAlign = o.horizontalAlign;
    if (o.horizontalOffset !== undefined) out.horizontalOffset = o.horizontalOffset;
    return Object.keys(out).length > 0 ? out : undefined;
  }

  hasAlignmentOverride(wordId: string): boolean {
    const o = this.entries.get(wordId);
    if (o === undefined) return false;
    return o.verticalAlign !== undefined
        || o.verticalOffset !== undefined
        || o.horizontalAlign !== undefined
        || o.horizontalOffset !== undefined;
  }

  toRecord(): WordStyleOverridesSnapshot {
    const out: Record<string, WordStyleOverrides> = {};
    for (const [k, v] of this.entries) out[k] = v;
    return out;
  }
}
