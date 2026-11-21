import type { CssFilterReferenceScanner, CssMinifier, CssVarReferenceScanner } from '@tscaps/engine/advanced';
import type { ReferencedSvgFilterVariableScanner } from '@core/sheets/services/ReferencedSvgFilterVariableScanner';

const CONTROL_VARIABLE_PREFIX = '--tscaps-';

/** The two documents a caption's look is written in. */
export interface StyleSources {
  readonly css: string;
  readonly filtersSvg: string;
}

/**
 * Finds the controls an edit has cut loose: ones the authored sources
 * consumed through a `var()` and the current sources do not.
 *
 * The question is deliberately differential rather than absolute.
 * "Does anything read this control?" cannot be answered from the
 * sources: a control can be consumed by the stylesheet, by the filters
 * document, or by application code that never mentions a variable at
 * all — a palette rotation driven by a `select` works that way. Asking
 * whether a control is read at all would report those as dead while
 * they work perfectly.
 *
 * Asking what an edit removed has no such blind spot. A control the
 * author never wired through these two documents is in neither set and
 * is never reported; one that was wired and no longer is was
 * disconnected by the edit, and by nothing else.
 *
 * Results are control ids rather than variable names, so a caller can
 * match them against the fields it renders.
 *
 * One reading survives that the render does not: a control read only
 * inside an `@keyframes` block counts as read even when no declaration
 * animates that block any more.
 */
export class DisconnectedControlFinder {
  constructor(
    private readonly minifier: CssMinifier,
    private readonly scanner: CssVarReferenceScanner,
    private readonly filterReferenceScanner: CssFilterReferenceScanner,
    private readonly filterVariableScanner: ReferencedSvgFilterVariableScanner,
  ) {}

  find(authored: StyleSources, current: StyleSources): ReadonlySet<string> {
    const wired = this.controlVariablesRead(authored);
    if (wired.size === 0) return new Set();
    const stillWired = this.controlVariablesRead(current);

    const disconnected = new Set<string>();
    for (const variable of wired) {
      if (stillWired.has(variable)) continue;
      disconnected.add(variable.slice(CONTROL_VARIABLE_PREFIX.length));
    }
    return disconnected;
  }

  private controlVariablesRead(sources: StyleSources): ReadonlySet<string> {
    const found = new Set<string>();
    // Comments are stripped from the stylesheet on purpose: a variable
    // parked in one satisfies the template loader's authoring check
    // without anything reading it, and the question here is what takes
    // effect.
    const css = this.minifier.minify(sources.css);
    this.collect(this.scanner.scan(css), found);
    this.collect(this.filterVariablesRead(sources.filtersSvg, css), found);
    return found;
  }

  /**
   * What the filter document contributes is decided by the stylesheet:
   * a filter reaches a caption only through the `url(#id)` that points
   * at it, so dropping that reference takes the filter's controls out
   * of use as surely as deleting the filter would.
   */
  private filterVariablesRead(filtersSvg: string, minifiedCss: string): ReadonlySet<string> {
    return this.filterVariableScanner.scan(filtersSvg, this.filterReferenceScanner.scan(minifiedCss));
  }

  private collect(names: ReadonlySet<string>, into: Set<string>): void {
    for (const name of names) {
      if (name.startsWith(CONTROL_VARIABLE_PREFIX)) into.add(name);
    }
  }
}
