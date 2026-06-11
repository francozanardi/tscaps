const FILTER_URL_REF_RE = /url\(\s*(['"]?)#([a-zA-Z0-9_-]+)\1\s*\)/g;

const BINDING_VAR_PREFIX = '--svg-filter-';

/**
 * Output of `SvgFilterScoper.rewriteCss`. The stylesheet with every
 * `url(#localId)` filter reference replaced by a CSS-variable
 * indirection, plus the set of local ids that were rewritten — the
 * caller must bind each one on an element that contains the
 * filtered descendants.
 */
export interface CssRewriteResult {
  readonly css: string;
  readonly localIds: ReadonlySet<string>;
}

/**
 * Output of `SvgFilterScoper.scopeIds`. `idByLocal` maps each local
 * id to its scoped counterpart (the value to emit inside
 * `<filter id="…">` in the SVG defs block). `bindings` maps each
 * CSS variable name to the `url(#scopedId)` expression to splice
 * into a wrapper element's inline style.
 */
export interface IdScopeResult {
  readonly idByLocal: ReadonlyMap<string, string>;
  readonly bindings: ReadonlyMap<string, string>;
}

/**
 * Generates a unique namespace for a set of `<filter>` ids and pairs
 * those scoped ids with the CSS variables that consuming elements
 * use to reach them. The same scheme rewrites the stylesheet's
 * `url(#id)` references so the binding chain is closed.
 *
 * The indirection is what lets independent filter sets coexist in
 * the same SVG document without id collisions, and what makes
 * per-tile filters compatible with stylesheets that animate
 * `filter:` via `@keyframes`: an inline style cannot override an
 * active animation value, but it CAN supply the variable the
 * animation references, which is resolved per element through
 * ordinary CSS variable inheritance.
 *
 * Only the top-level `<filter>` ids are rewritten. The SVG filter
 * primitive id space (`in`, `result`, `feMergeNode in=...`) is local
 * to each `<filter>` element and is left untouched.
 */
export class SvgFilterScoper {
  /**
   * Replaces every `url(#localId)` reference in the stylesheet with
   * `var(--svg-filter-<localId>)`. The local ids that were
   * encountered are returned so the caller knows which variables a
   * consuming element must bind. Refs that point at an id the
   * caller never binds resolve to the empty filter list at render
   * time — equivalent to no filter.
   */
  rewriteCss(css: string): CssRewriteResult {
    const localIds = new Set<string>();
    const rewritten = css.replace(FILTER_URL_REF_RE, (_match, _quote, id) => {
      localIds.add(id);
      return `var(${this.bindingVarName(id)})`;
    });
    return { css: rewritten, localIds };
  }

  /**
   * Generates a scoped id for each local id under `scopeKey` and
   * returns the inline-style bindings that wire each
   * `--svg-filter-<localId>` to its scoped URL. `scopeKey` must be
   * unique among coexisting filter sets in the same SVG document.
   */
  scopeIds(localIds: Iterable<string>, scopeKey: string): IdScopeResult {
    const idByLocal = new Map<string, string>();
    const bindings = new Map<string, string>();
    for (const localId of localIds) {
      const scopedId = `tscaps-filter-${scopeKey}-${localId}`;
      idByLocal.set(localId, scopedId);
      bindings.set(this.bindingVarName(localId), `url(#${scopedId})`);
    }
    return { idByLocal, bindings };
  }

  private bindingVarName(localId: string): string {
    return `${BINDING_VAR_PREFIX}${localId}`;
  }
}
