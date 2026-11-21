import { CssVariable } from '@modules/document/CssVariable';
import type { FootageClockUseInspector } from '@modules/video/stage/FootageClockUseInspector';

/** One `property: value` of a stylesheet. */
interface CssDeclaration {
  readonly property: string;
  readonly value: string;
}

// The properties an animation takes its timing from. A time in `animation` may still be its length
// rather than its delay, which only the document can tell once it has read the list.
const TIMING_PROPERTIES = new Set(['animation', 'animation-delay']);
const CLOCK_PROPERTIES: ReadonlyArray<string> = [CssVariable.LAYER_STARTS, CssVariable.LAYER_ENDS];
const COMMENT = /\/\*[\s\S]*?\*\//g;
const PROPERTY_NAME = /^(?:--[\w-]+|[a-zA-Z-]+)$/;
const IMPORTANT = /!\s*important\s*$/i;
const NAME_CHARACTER = /[\w-]/;

/**
 * {@link FootageClockUseInspector} that reads the stylesheet's text.
 *
 * It follows the clock through custom properties: one whose value reads
 * the clock carries it, and so does one reading that one. Every place
 * the clock or a carrier is read has to be a declaration of `animation`,
 * of `animation-delay`, or of another custom property, and there it has
 * to stand on its own or lead a `calc()` that adds to it or takes from
 * it, so that what reaches the animation is the clock plus something
 * that does not move.
 *
 * The answer errs towards false: every mention of the clock or a
 * carrier in the text has to be one of the reads it understood, so a
 * mention it could not place (in a rule it did not parse, a selector, a
 * string) makes the whole stylesheet one that reads the clock elsewhere.
 */
export class CssFootageClockUseInspector implements FootageClockUseInspector {
  readsClockOnlyToTimeAnimations(css: string): boolean {
    const text = css.replace(COMMENT, ' ');
    const declarations = this.declarationsOf(text);
    const carriers = new Set(CLOCK_PROPERTIES);
    // A stylesheet that sets the clock itself is not reading the one it is given.
    if (declarations.some((declaration) => carriers.has(declaration.property))) return false;
    for (let found = true; found;) {
      found = false;
      for (const declaration of declarations) {
        if (!this.reads(declaration.value, carriers)) continue;
        if (!this.readsOnlyAddedTo(declaration.value, carriers)) return false;
        if (TIMING_PROPERTIES.has(declaration.property)) continue;
        if (!declaration.property.startsWith('--')) return false;
        if (carriers.has(declaration.property)) continue;
        carriers.add(declaration.property);
        found = true;
      }
    }
    return [...carriers].every((carrier) => this.everyMentionIsUnderstood(text, declarations, carrier));
  }

  /**
   * Every declaration inside a block of `text`, however deep the block.
   * What comes before a `{` is a selector or an at-rule's prelude, not a
   * declaration; a `;`, `{` or `}` inside parentheses or a string is
   * part of a value.
   */
  private declarationsOf(text: string): CssDeclaration[] {
    const declarations: CssDeclaration[] = [];
    let blockDepth = 0;
    let parenthesisDepth = 0;
    let quote: string | null = null;
    let chunkStart = 0;
    for (let index = 0; index < text.length; index++) {
      const character = text[index]!;
      if (quote !== null) {
        if (character === '\\') index++;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === '\'') quote = character;
      else if (character === '(') parenthesisDepth++;
      else if (character === ')') parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      if (parenthesisDepth > 0 || (character !== '{' && character !== '}' && character !== ';')) continue;
      if (character !== '{' && blockDepth > 0) {
        const declaration = this.declarationOf(text.slice(chunkStart, index));
        if (declaration !== null) declarations.push(declaration);
      }
      if (character === '{') blockDepth++;
      if (character === '}') blockDepth = Math.max(0, blockDepth - 1);
      chunkStart = index + 1;
    }
    return declarations;
  }

  private declarationOf(chunk: string): CssDeclaration | null {
    const colon = chunk.indexOf(':');
    if (colon === -1) return null;
    const name = chunk.slice(0, colon).trim();
    if (!PROPERTY_NAME.test(name)) return null;
    return {
      property: name.startsWith('--') ? name : name.toLowerCase(),
      value: chunk.slice(colon + 1).replace(IMPORTANT, '').trim(),
    };
  }

  private reads(value: string, carriers: ReadonlySet<string>): boolean {
    return [...carriers].some((carrier) => this.readsOf(value, carrier).length > 0);
  }

  /** Where `value` reads `property` through `var()`: the index of each `var(`. */
  private readsOf(value: string, property: string): number[] {
    const reads: number[] = [];
    for (const mention of this.mentionsOf(value, property)) {
      const before = value.slice(0, mention).trimEnd();
      if (before.endsWith('var(')) reads.push(before.length - 'var('.length);
    }
    return reads;
  }

  /** Where `text` names `property` as a whole name, not as the start or the end of a longer one. */
  private mentionsOf(text: string, property: string): number[] {
    const mentions: number[] = [];
    for (let index = text.indexOf(property); index !== -1; index = text.indexOf(property, index + 1)) {
      const before = index === 0 ? '' : text[index - 1]!;
      const after = text[index + property.length] ?? '';
      if (!NAME_CHARACTER.test(before) && !NAME_CHARACTER.test(after)) mentions.push(index);
    }
    return mentions;
  }

  /**
   * Whether every read of a carrier in `value` is on its own, outside
   * any function, or is the first term of a `calc()` that is itself
   * outside any function and goes on to add or to take away.
   */
  private readsOnlyAddedTo(value: string, carriers: ReadonlySet<string>): boolean {
    return [...carriers].every((carrier) => this.readsOf(value, carrier).every((read) => this.isAddedTo(value, read)));
  }

  private isAddedTo(value: string, read: number): boolean {
    const enclosing = this.functionsOpenAt(value, read);
    if (enclosing.length === 0) return true;
    if (enclosing.length > 1 || enclosing[0]!.name !== 'calc') return false;
    if (value.slice(enclosing[0]!.opensAt + 1, read).trim() !== '') return false;
    const next = value.slice(this.closingOf(value, read + 'var'.length) + 1).trimStart()[0];
    return next === '+' || next === '-' || next === ')';
  }

  /** The functions whose parentheses are open at `index` of `value`, outermost first. */
  private functionsOpenAt(value: string, index: number): Array<{ name: string; opensAt: number }> {
    const open: Array<{ name: string; opensAt: number }> = [];
    for (let position = 0; position < index; position++) {
      if (value[position] === '(') open.push({ name: this.nameBefore(value, position), opensAt: position });
      else if (value[position] === ')') open.pop();
    }
    return open;
  }

  private nameBefore(value: string, parenthesis: number): string {
    let start = parenthesis;
    while (start > 0 && NAME_CHARACTER.test(value[start - 1]!)) start--;
    return value.slice(start, parenthesis).toLowerCase();
  }

  /** The index of the `)` closing the `(` at `opening`; the end of `value` where it never closes. */
  private closingOf(value: string, opening: number): number {
    let depth = 0;
    for (let position = opening; position < value.length; position++) {
      if (value[position] === '(') depth++;
      else if (value[position] === ')' && --depth === 0) return position;
    }
    return value.length;
  }

  /** Whether every mention of `carrier` in `text` is one of its declarations or a read inside a declaration's value. */
  private everyMentionIsUnderstood(text: string, declarations: ReadonlyArray<CssDeclaration>, carrier: string): boolean {
    const declared = declarations.filter((declaration) => declaration.property === carrier).length;
    const read = declarations.reduce((count, declaration) => count + this.readsOf(declaration.value, carrier).length, 0);
    const mentionedInOwnValues = declarations
      .reduce((count, declaration) => count + this.mentionsOf(declaration.value, carrier).length, 0);
    return mentionedInOwnValues === read && this.mentionsOf(text, carrier).length === declared + read;
  }
}
