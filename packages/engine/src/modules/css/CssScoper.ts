const KEYFRAME_NAME_RE = /@(?:-webkit-|-moz-)?keyframes\s+([a-zA-Z_-][a-zA-Z0-9_-]*)/g;

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Scopes a CSS string so it can coexist with sibling stylesheets in
 * the same document. Top-level selectors get prefixed with
 * `scopeSelector`; every `@keyframes` declaration is renamed to a
 * scope-unique form and the matching `animation-name` / `animation`
 * shorthand references in the same stylesheet are rewritten in step.
 *
 * `scopeSelector` is expected to be a simple class selector
 * (e.g. `.my-scope`); its identifier portion seeds the keyframe rename.
 */
export class CssScoper {
  scope(css: string, scopeSelector: string): string {
    const scopeKey = scopeSelector.replace(/^\.+/, '');
    return this.scopeSelectors(this.scopeKeyframes(css, scopeKey), scopeSelector);
  }

  private scopeKeyframes(css: string, scopeKey: string): string {
    const names = new Set<string>();
    for (const m of css.matchAll(KEYFRAME_NAME_RE)) names.add(m[1]!);
    if (names.size === 0) return css;
    let result = css;
    for (const name of names) {
      const scopedName = `${name}-${scopeKey}`;
      const esc = escapeRegex(name);
      result = result.replace(
        new RegExp(`(@(?:-webkit-|-moz-)?keyframes\\s+)${esc}(?![\\w-])`, 'g'),
        `$1${scopedName}`,
      );
      // Both `animation-name:` and the `animation:` shorthand can carry a
      // comma-separated list of names. The rewrite scans the whole value
      // range (between `:` and the next `;` or rule boundary) and replaces
      // every whole-word occurrence, so the second entry in
      // `animation-name: foo, bar` is reached. The value-bounded scope
      // avoids touching a class or property elsewhere that happens to
      // share the spelling.
      const replaceInValue = (_m: string, prefix: string, value: string): string =>
        prefix + value.replace(new RegExp(`(?<![\\w-])${esc}(?![\\w-])`, 'g'), scopedName);
      result = result.replace(/(animation-name\s*:\s*)([^;{}]*)/g, replaceInValue);
      result = result.replace(/(animation\s*:\s*)([^;{}]*)/g, replaceInValue);
    }
    return result;
  }

  private scopeSelectors(css: string, scopeSelector: string): string {
    let result = '';
    let i = 0;
    let depth = 0;

    while (i < css.length) {
      if (css[i] === '{') {
        depth++;
        result += '{';
        i++;
      } else if (css[i] === '}') {
        depth--;
        result += '}';
        i++;
      } else if (depth === 0) {
        const remaining = css.slice(i);
        const ws = remaining.match(/^\s+/);
        if (ws) {
          result += ws[0];
          i += ws[0].length;
          continue;
        }
        // Top-level comments — copy through. Without this, a comment placed
        // before an @-rule (e.g. `/* note */ @keyframes foo`) would be
        // swallowed into the regular-selector branch and fed to the scoper
        // alongside the @-rule header, producing invalid CSS that drops the
        // whole rule.
        if (remaining.startsWith('/*')) {
          const end = remaining.indexOf('*/');
          if (end === -1) { result += remaining; break; }
          result += remaining.slice(0, end + 2);
          i += end + 2;
          continue;
        }
        const brace = remaining.indexOf('{');
        if (brace === -1) { result += remaining; break; }
        if (remaining.startsWith('@')) {
          result += remaining.slice(0, brace + 1);
          i += brace + 1;
          depth++;
        } else {
          const selector = remaining.slice(0, brace).trim();
          const scoped = selector
            .split(',')
            .map(s => `${scopeSelector} ${s.trim()}`)
            .join(', ');
          result += `${scoped} {`;
          i += brace + 1;
          depth++;
        }
      } else {
        result += css[i];
        i++;
      }
    }

    return result;
  }
}
