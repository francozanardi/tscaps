import type { ElementCssContext } from '@core/elements/domain/ElementCssContext';
import type { ElementCssProblem } from '@core/elements/domain/ElementCssProblem';
import type { ElementCssRule } from '@core/elements/domain/ElementCssRule';

// A declaration: a name, a colon, and a value ending where the
// declaration does. A selector such as `&:hover {` ends at a brace and is
// left out.
const DECLARATION = /(?:^|[;{}])\s*(--[\w-]+|[a-zA-Z][\w-]*)\s*:\s*([^;{}]*)(?=[;}]|$)/g;

// What the canvas draws a layer from: the box, its transform, its
// opacity, a blur and a brightness, an inset clip, its corners and how the
// file fills it and where it sits in the box.
// The animation properties play those; the `--layer-*` and `--video-*`
// custom properties lay the box out and move the video.
const DRAWN_PROPERTIES: ReadonlySet<string> = new Set([
  'left', 'top', 'right', 'bottom', 'inset', 'width', 'height',
  'min-width', 'max-width', 'min-height', 'max-height',
  'margin', 'margin-left', 'margin-top', 'margin-right', 'margin-bottom',
  'transform', 'transform-origin', 'translate', 'rotate', 'scale',
  'opacity', 'filter', 'clip-path', 'border-radius', 'border-top-left-radius', 'object-fit', 'object-position',
  'animation', 'animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay',
  'animation-iteration-count', 'animation-direction', 'animation-fill-mode', 'animation-play-state',
  'animation-composition',
]);
const DRAWN_CUSTOM_PROPERTY = /^--(?:layer|video)-/;

/**
 * Flags what a shot layer's CSS says that draws nothing.
 *
 * A layer is not painted by the browser: its box is resolved, and the
 * canvas draws the file from a short list of what was resolved. A
 * declaration outside that list is applied to a box nobody sees, so it
 * reads as CSS that was ignored. Allowed: the box's geometry, `transform`
 * and its parts, `opacity`, a filter of `blur()` and `brightness()`, an
 * `inset()` clip, `border-radius`, `object-fit`, `object-position`, the
 * animation properties that play
 * them, and the `--layer-*` and `--video-*` custom properties. A filter
 * holding any other function, or a clip other than an inset, is flagged
 * too.
 *
 * Says nothing about any other kind of element: a caption is painted by
 * the browser, so everything it says draws.
 */
export class UndrawnLayerDeclarationElementCssRule implements ElementCssRule {
  check(minifiedCss: string, context: ElementCssContext): ElementCssProblem[] {
    if (context.kind !== 'layer') return [];
    const problems = new Map<string, ElementCssProblem>();
    for (const match of minifiedCss.matchAll(DECLARATION)) {
      const property = match[1]!.toLowerCase();
      const value = match[2]!.trim();
      const problem = this.problemOf(property, value);
      if (problem !== null && !problems.has(property)) problems.set(property, problem);
    }
    return [...problems.values()];
  }

  private problemOf(property: string, value: string): ElementCssProblem | null {
    if (DRAWN_CUSTOM_PROPERTY.test(property)) return null;
    if (property === 'filter' && !this.isChainOf(value, ['blur', 'brightness', 'var'])) {
      return { message: 'Only blur() and brightness() in filter draw on a layer; the rest of this filter is ignored.' };
    }
    if (property === 'clip-path' && !this.isOneOf(value, ['inset', 'var'])) {
      return { message: 'Only an inset() clip-path draws on a layer; this clip is ignored.' };
    }
    if (DRAWN_PROPERTIES.has(property)) return null;
    return {
      message: `${property} draws nothing on a layer. A layer draws its box, transform, opacity, a blur and a brightness, an inset clip, its corners, object-fit and object-position, and reads the --layer-* and --video-* properties.`,
    };
  }

  /**
   * Whether `value` is `none`, or calls of `functions` alone, one after
   * another: `blur(2px) brightness(3)` is, `blur(2px) contrast(1)` is not.
   */
  private isChainOf(value: string, functions: ReadonlyArray<string>): boolean {
    if (value.toLowerCase() === 'none') return true;
    let rest = value.trim();
    while (rest.length > 0) {
      const end = this.callEnd(rest, functions);
      if (end === -1) return false;
      rest = rest.slice(end + 1).trim();
    }
    return true;
  }

  /**
   * Whether `value` is `none`, or a single call of one of `functions`
   * spanning the whole of it: `blur(calc(…))` is, `blur(2px) contrast(1)`
   * is not. A `var()` counts, since what it holds is not known here.
   */
  private isOneOf(value: string, functions: ReadonlyArray<string>): boolean {
    if (value.toLowerCase() === 'none') return true;
    return this.callEnd(value, functions) === value.length - 1;
  }

  /** Where the call of one of `functions` that `value` opens with closes, or -1 when it opens with none. */
  private callEnd(value: string, functions: ReadonlyArray<string>): number {
    const open = value.indexOf('(');
    if (open <= 0 || !functions.includes(value.slice(0, open).trim().toLowerCase())) return -1;
    let depth = 0;
    for (let index = open; index < value.length; index++) {
      if (value[index] === '(') depth++;
      if (value[index] === ')') depth--;
      if (depth === 0) return index;
    }
    return -1;
  }
}
