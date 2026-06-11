/**
 * Canonical CSS class name for letter-level spans.
 *
 * Letters are not part of the persisted document tree — they're
 * created at render time, only when the rendering pipeline is
 * configured to split words into per-grapheme spans. This class
 * exists as the single source of truth for the class name so other
 * engine modules and consumers reference one identifier instead of
 * a literal string.
 *
 * No instances are needed; the constructor is private.
 */
export class Letter {
  static readonly CSS_CLASS = 'letter';

  private constructor() {}
}
