const KEYFRAME_NAME_RE = /@(?:-webkit-|-moz-)?keyframes\s+([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
const SELECTOR_SPECIAL_CHARS_RE = /[.*+?^${}()|[\]\\]/g;

/**
 * Renames every `@keyframes` in a stylesheet to a form unique to
 * `key`, and rewrites the `animation-name` / `animation` references
 * that point at them in step.
 *
 * Keyframe names are global to the document, so two stylesheets that
 * both define `fade-in` silently share whichever one loaded last.
 * Anything emitting more than one stylesheet into the same document —
 * or more than one independently-authored block into the same
 * stylesheet — has to pass its blocks through here first.
 *
 * `key` becomes part of a CSS identifier, so it must be spellable as
 * one: letters, digits, `_` and `-`. A key carrying anything else turns
 * every `@keyframes` it names into a syntax error, which costs the
 * animations that referenced them and says nothing about why.
 */
export class CssKeyframeNamespacer {
  namespace(css: string, key: string): string {
    const names = new Set<string>();
    for (const match of css.matchAll(KEYFRAME_NAME_RE)) names.add(match[1]!);
    if (names.size === 0) return css;

    let result = css;
    for (const name of names) {
      result = this.renameOne(result, name, `${name}-${key}`);
    }
    return result;
  }

  private renameOne(css: string, name: string, renamed: string): string {
    const escaped = name.replace(SELECTOR_SPECIAL_CHARS_RE, '\\$&');
    let result = css.replace(
      new RegExp(`(@(?:-webkit-|-moz-)?keyframes\\s+)${escaped}(?![\\w-])`, 'g'),
      `$1${renamed}`,
    );
    // Both `animation-name:` and the `animation:` shorthand can carry a
    // comma-separated list of names. The rewrite scans the whole value
    // range (between `:` and the next `;` or rule boundary) and replaces
    // every whole-word occurrence, so the second entry in
    // `animation-name: foo, bar` is reached. The value-bounded scope
    // avoids touching a class or property elsewhere that happens to
    // share the spelling. A custom property whose name ends in
    // `animation` is read the same way: it holds a shorthand for an
    // `animation` declaration to read later, and its reference has to
    // follow the rename as much as the declaration's own would.
    const replaceInValue = (_m: string, prefix: string, value: string): string =>
      prefix + value.replace(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, 'g'), renamed);
    result = result.replace(/(animation-name\s*:\s*)([^;{}]*)/g, replaceInValue);
    result = result.replace(/(animation\s*:\s*)([^;{}]*)/g, replaceInValue);
    return result;
  }
}
