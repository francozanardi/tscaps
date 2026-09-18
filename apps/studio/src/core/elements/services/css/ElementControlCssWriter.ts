import type { CssFragmentDeclaration, CssFragmentParser } from '@tscaps/engine';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { FontStackFaces } from '@core/fonts/domain/FontStackCatalog';

const NUMBER_WITH_UNIT = /^(-?\d*\.?\d+)([a-z%]*)$/i;

/** A number a slider holds, the option a select holds, or the stack a font picker holds. */
export type ElementControlValue = number | string | FontStackFaces;

/**
 * Moves one field's declaration inside CSS this code generated.
 *
 * Never user text. What it reads, it reads only to write the rest of
 * back unchanged: a signed value split between a direction and a
 * distance shares one declaration, so setting either has to find the
 * half it is not setting and keep it.
 *
 * Knows nothing about what the field is for. An entrance's distance
 * and a word's colour would be the same job.
 */
export class ElementControlCssWriter {
  constructor(private readonly parser: CssFragmentParser) {}

  /**
   * A font field writes nothing, and leaves whatever it finds alone.
   *
   * What it holds is a stack, and what draws is the family that stack
   * compiles to — a name built from the alphabets the captions are
   * written in, which change as the captions do. The record cannot
   * carry it, so the render layers it over the element as an inline
   * style, which outranks anything a stylesheet says. A declaration
   * here could only spell the stack out plainly, and that names faces
   * that never draw: text read as what renders while being ignored by
   * it, and a face named in an element's CSS is a face the export
   * embeds. Leaving the text untouched is also what keeps the takeover
   * question honest — nothing written by hand can take this field over,
   * so nothing may report that it did. Clearing the field still takes
   * back a declaration an older version of this left behind.
   */
  write(css: string, control: AuthoredElementControl, value: ElementControlValue): string {
    if (control.type === 'font') return css;
    return this.withDeclaration(css, control.property, this.valueToWrite(css, control, value));
  }

  /**
   * The CSS without what this control had to say, and without the
   * blank space that separated it from the declaration before.
   *
   * A control sharing its property with another takes only its own
   * token out and leaves the declaration standing, since removing the
   * whole thing would take the other control's answer with it. Once no
   * token is left the declaration goes too: a property spelling out
   * that it is off is not the same as a property that never spoke, and
   * only the second one lets the value come back down from above.
   */
  remove(css: string, control: AuthoredElementControl): string {
    if (control.part === 'keyword') {
      const { off } = this.tokens(control);
      const remaining = this.withToken(control, this.declaredValue(css, control.property), off);
      if (remaining !== off) return this.withDeclaration(css, control.property, remaining);
    }
    const existing = this.lastDeclarationOf(css, control.property);
    return existing ? css.slice(0, existing.start) + css.slice(existing.end) : css;
  }

  private valueToWrite(css: string, control: AuthoredElementControl, value: ElementControlValue): string {
    if (control.part === 'keyword') {
      return this.withToken(control, this.declaredValue(css, control.property), String(value));
    }
    if (!this.isNumeric(control)) return String(value);
    const declared = this.declaredValue(css, control.property);
    const unit = control.unit ?? this.unitOf(declared) ?? '';
    if (control.part === 'whole') return `${Number(value)}${unit}`;

    const current = this.amountOf(declared) ?? 0;
    const magnitude = control.part === 'magnitude' ? Math.abs(Number(value)) : Math.abs(current);
    const negative = control.part === 'sign' ? value === 'negative' : current < 0;
    return `${negative ? -magnitude : magnitude}${unit}`;
  }

  /** Whether the field's value is a number to do arithmetic on rather than text to pass through. */
  private isNumeric(control: AuthoredElementControl): boolean {
    return control.type === 'number' || control.part === 'sign' || control.part === 'magnitude';
  }

  /** The token this control owns, and what the property reads as without it. */
  private tokens(control: AuthoredElementControl): { readonly on: string; readonly off: string } {
    const options = control.options ?? [];
    return { off: options[0]?.value ?? '', on: options[1]?.value ?? '' };
  }

  /**
   * The property's value once this control's token has been put in or
   * taken out, leaving whatever else it carries where it was. Written
   * out even when nothing changed, so the declaration exists for the
   * other half of the property to be read back from.
   *
   * A token already present stays where it is rather than moving to
   * the end, so switching a control to the state it is already in
   * gives back the same value it was given.
   */
  private withToken(control: AuthoredElementControl, declared: string | null, next: string): string {
    const { on, off } = this.tokens(control);
    const present = (declared ?? '').trim().split(/\s+/).filter((token) => token !== '' && token !== off);
    const all = next === on
      ? (present.includes(on) ? present : [...present, on])
      : present.filter((token) => token !== on);
    return all.length > 0 ? all.join(' ') : off;
  }

  private declaredValue(css: string, property: string): string | null {
    return this.lastDeclarationOf(css, property)?.value ?? null;
  }

  /** The declaration that decides the property, which is the last one to set it. */
  private lastDeclarationOf(css: string, property: string): CssFragmentDeclaration | null {
    return this.parser.parse(css)
      .filter((part) => part.kind === 'declaration')
      .filter((declaration) => declaration.property === property)
      .at(-1) ?? null;
  }

  private amountOf(value: string | null): number | null {
    const match = value === null ? null : NUMBER_WITH_UNIT.exec(value.trim());
    return match ? Number(match[1]) : null;
  }

  private unitOf(value: string | null): string | null {
    const match = value === null ? null : NUMBER_WITH_UNIT.exec(value.trim());
    return match ? match[2]! : null;
  }

  /**
   * Rewrites the property in place, or introduces it after everything
   * the text already carries.
   *
   * Nothing is ever inserted between what is already there. A block
   * written by other machinery — an entrance is one, its declarations
   * and its keyframes together — is recognised later by looking for
   * exactly the text it produced, and a declaration landing in the
   * middle of one would report it as edited by hand.
   *
   * A rewrite replaces the declaration and not the blank space in
   * front of it, so writing a value the text already carries returns
   * that same text unchanged. Callers compare the two to tell a
   * declaration the fields still own from one edited by hand, and a
   * newline moved on every write would report every field as edited.
   */
  private withDeclaration(css: string, property: string, value: string): string {
    const existing = this.lastDeclarationOf(css, property);
    if (existing) {
      const gap = /^\s*/.exec(css.slice(existing.start, existing.end))?.[0].length ?? 0;
      return css.slice(0, existing.start + gap) + `${property}: ${value};` + css.slice(existing.end);
    }
    const line = `${property}: ${value};`;
    return css.trim().length > 0 ? `${css.trimEnd()}\n${line}` : line;
  }

}
