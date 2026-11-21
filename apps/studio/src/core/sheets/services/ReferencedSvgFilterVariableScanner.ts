import type { CssVarReferenceScanner } from '@tscaps/engine/advanced';

const FILTER_ELEMENT_PATTERN = /<filter\b([^>]*[^/>])?>[\s\S]*?<\/filter>/g;
const ID_ATTRIBUTE_PATTERN = /\bid\s*=\s*["']([^"']*)["']/;
const COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

/**
 * Reads the custom properties a filter document consumes on behalf of
 * the filters a stylesheet points at.
 *
 * A filter document renders nothing on its own. Every `<filter>` in it
 * waits for a `url(#id)` from the stylesheet, so one nothing points at
 * consumes nothing either, however many `var()` references it spells
 * out. Counting those would answer that the document reads a property
 * when the rendered caption never asks for it.
 *
 * Comments are dropped first, on the same reasoning: what is commented
 * out reaches no renderer.
 */
export class ReferencedSvgFilterVariableScanner {
  constructor(private readonly varReferenceScanner: CssVarReferenceScanner) {}

  /**
   * The custom property names read by the filters `referencedIds`
   * names. Ids the document does not define contribute nothing, and an
   * empty set of ids means the document is inert.
   */
  scan(filtersSvg: string, referencedIds: ReadonlySet<string>): ReadonlySet<string> {
    const found = new Set<string>();
    if (referencedIds.size === 0) return found;
    for (const element of filtersSvg.replace(COMMENT_PATTERN, '').matchAll(FILTER_ELEMENT_PATTERN)) {
      const id = ID_ATTRIBUTE_PATTERN.exec(element[1] ?? '')?.[1];
      if (id === undefined || !referencedIds.has(id)) continue;
      for (const name of this.varReferenceScanner.scan(element[0])) found.add(name);
    }
    return found;
  }
}
