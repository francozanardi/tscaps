import type { CssFragmentDeclaration, CssFragmentParser } from '@tscaps/engine/advanced';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/**
 * The property a template derives from each variable a caption field
 * writes, on the element that holds it. Mirrors the template library's
 * caption typography.
 */
const PROPERTY_BY_VARIABLE: ReadonlyMap<string, string> = new Map([
  [TemplateCssVariable.FONT_SIZE, 'font-size'],
  [TemplateCssVariable.FONT_WEIGHT, 'font-weight'],
  [TemplateCssVariable.FONT_STYLE, 'font-style'],
  [TemplateCssVariable.PRIMARY_COLOR, 'color'],
  [TemplateCssVariable.ROTATION, 'rotate'],
]);

/**
 * Finds the declaration in an element's own CSS that hides what one of
 * its fields holds.
 *
 * A segment's or a line's field writes a template variable rather than
 * the property itself, and the template turns that variable into the
 * property on the element. A declaration of the same property in the
 * element's own CSS (`font-size: 1.4em` beside the size field) wins over
 * what the template derives, so the field changes nothing on screen.
 * Only declarations at the CSS's top level count: one inside a nested
 * rule styles something else.
 */
export class FieldShadowingDeclarations {
  constructor(private readonly parser: CssFragmentParser) {}

  /** The top-level declaration in `css` that hides `control`'s value, or null when nothing does. */
  find(css: string, control: AuthoredElementControl): CssFragmentDeclaration | null {
    const property = PROPERTY_BY_VARIABLE.get(control.property);
    if (property === undefined) return null;
    return this.parser.parse(css)
      .filter((part): part is CssFragmentDeclaration => part.kind === 'declaration')
      .filter((declaration) => declaration.property === property)
      .at(-1) ?? null;
  }

  /** `css` with every top-level declaration that hides `control`'s value taken out, the rest as written. */
  without(css: string, control: AuthoredElementControl): string {
    let next = css;
    for (let shadow = this.find(next, control); shadow !== null; shadow = this.find(next, control)) {
      next = `${next.slice(0, shadow.start).trimEnd()}${next.slice(shadow.end)}`.trim();
    }
    return next;
  }
}
