/**
 * A `@font-face` rule lifted from a stylesheet, with the unicode-range
 * pulled out so callers can filter by codepoint coverage without
 * reparsing `cssText`.
 */
export interface FontFaceDeclaration {
  readonly cssText: string;
  readonly unicodeRange: string;
}
