import type { ElementCssContext } from '@core/elements/domain/ElementCssContext';
import type { ElementCssProblem } from '@core/elements/domain/ElementCssProblem';
import type { ElementCssRule } from '@core/elements/domain/ElementCssRule';

// `animation`, `animation-name`, and a custom property ending in
// `-animation`: the shorthand an element publishes for the framework to
// play, as a shot layer's entrance and exit do.
const ANIMATION_DECLARATION = /(?:^|[;{}\s])(?:animation(?:-name)?|--[\w-]*-animation)\s*:([^;{}]*)/g;
const PLAYHEAD_VARIABLE_REFERENCE = /var\(\s*--on-/;
// An `animation` made of nothing but published halves, each falling back
// to `none`: it plays whatever was published, and holds no frame itself.
const PUBLISHED_HALVES = /^var\(\s*--[\w-]+-animation\s*,\s*none\s*\)(?:\s*,\s*var\(\s*--[\w-]+-animation\s*,\s*none\s*\))*$/i;

/**
 * Flags an animation with nothing tying it to the playhead.
 *
 * Animations here never run on their own: every one of them is paused,
 * and the frame on screen is whichever one the delay lands on. A delay
 * that is a constant therefore picks one frame and holds it forever, so
 * an animation without a `--on-…` variable in it is not a slow animation
 * or a broken one — it is a still image, and it looks exactly like CSS
 * that was ignored.
 *
 * Any `--on-…` event counts, the element's start or its end: an exit is
 * delayed from the moment the element stops, a shot layer's from
 * `--on-layer-ends`.
 *
 * An element that turns animation off has no frame to hold, so saying
 * nothing is the whole of the advice there. Nor does the declaration
 * that only plays the halves an element's ends published: what it plays
 * is what gets checked.
 */
export class PlayheadAnchoredAnimationElementCssRule implements ElementCssRule {
  check(minifiedCss: string, context: ElementCssContext): ElementCssProblem[] {
    if (!this.animatesAnything(minifiedCss)) return [];
    if (PLAYHEAD_VARIABLE_REFERENCE.test(minifiedCss)) return [];
    return [{
      message: `This animation has no delay tied to the playhead, so it will hold its first frame. Use var(${context.timingVariable}) as the animation's delay, or var(${context.exitTimingVariable}) for one that plays as it leaves.`,
    }];
  }

  private animatesAnything(minifiedCss: string): boolean {
    const values = [...minifiedCss.matchAll(ANIMATION_DECLARATION)].map((match) => match[1]!.trim());
    return values.some((value) => value.toLowerCase() !== 'none' && !PUBLISHED_HALVES.test(value));
  }
}
