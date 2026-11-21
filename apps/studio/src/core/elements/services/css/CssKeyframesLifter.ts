/** What a stylesheet held: its `@keyframes` blocks, and everything else in it. */
export interface LiftedKeyframes {
  readonly hoisted: string[];
  readonly remaining: string;
}

/**
 * Takes every `@keyframes` block out of a stylesheet, whole.
 *
 * A block of declarations is wrapped in a selector or a cascade layer
 * before it is used, and `@keyframes` cannot live inside a style rule,
 * so those are set apart to sit at the top level beside it. The text is
 * expected to be sealed already: a block left open runs to the end.
 */
export class CssKeyframesLifter {
  lift(css: string): LiftedKeyframes {
    const hoisted: string[] = [];
    let remaining = '';
    let index = 0;
    while (index < css.length) {
      const start = this.findKeyframesStart(css, index);
      if (start === -1) {
        remaining += css.slice(index);
        break;
      }
      remaining += css.slice(index, start);
      const open = css.indexOf('{', start);
      if (open === -1) {
        remaining += css.slice(start);
        break;
      }
      const close = this.findMatchingClose(css, open);
      hoisted.push(css.slice(start, close + 1));
      index = close + 1;
    }
    return { hoisted, remaining };
  }

  private findKeyframesStart(css: string, from: number): number {
    const match = /@(?:-webkit-|-moz-)?keyframes\b/.exec(css.slice(from));
    return match ? from + match.index : -1;
  }

  /** Index of the `}` that closes the block opened at `open`, or the end of the string. */
  private findMatchingClose(css: string, open: number): number {
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      const ch = css[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return css.length - 1;
  }
}
