import { CssVariable } from '@tscaps/engine';
import {
  ANIMATED_KIND_BY_SCOPE,
  ANIMATION_PHASE_BY_SCOPE,
} from '@core/elements/domain/ElementAnimationScope';
import type { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import { LayerCssVariable } from '@core/elements/domain/LayerCssVariable';

/** What an element's clock exposes: when it begins to matter, and when it leaves the frame. */
interface ElementClock {
  readonly starts: string;
  readonly leaves: string;
}

const CLOCK_BY_KIND: Readonly<Record<ElementKind, ElementClock>> = {
  segment: { starts: CssVariable.SEGMENT_STARTS, leaves: CssVariable.SEGMENT_ENDS },
  // Everything a caption holds is on the frame for as long as the
  // caption is, so each of its parts leaves when the caption does —
  // never when its own narration ends, which is mid-caption.
  line: { starts: CssVariable.LINE_BEING_NARRATED_STARTS, leaves: CssVariable.SEGMENT_ENDS },
  word: { starts: CssVariable.WORD_BEING_NARRATED_STARTS, leaves: CssVariable.SEGMENT_ENDS },
  // A decoration carries the timing of the word it belongs to, whether
  // it is painted inside that word or promoted out of it.
  decoration: { starts: CssVariable.WORD_BEING_NARRATED_STARTS, leaves: CssVariable.SEGMENT_ENDS },
  layer: { starts: CssVariable.LAYER_STARTS, leaves: CssVariable.LAYER_ENDS },
};

/**
 * The variable an element's animation anchors to.
 *
 * Every state exposes a start, an end and a duration; this names the one
 * an animation usually wants — the moment the thing being animated
 * begins to matter, or, for an exit, the moment it leaves the frame.
 * Others stay available to anyone who knows to ask for them.
 *
 * A scope names what moves, so it also names whose clock it moves on: an
 * animation given to the words inside a caption runs on each word's own
 * clock, which is what makes them arrive one after another instead of
 * together with the caption. They leave together, with it.
 */
export class ElementTimingVariableResolver {
  resolve(kind: ElementKind, scope: ElementAnimationScope): string {
    const clock = CLOCK_BY_KIND[ANIMATED_KIND_BY_SCOPE[scope] ?? kind];
    const phase = ANIMATION_PHASE_BY_SCOPE[scope];
    if (phase === 'exit') return clock.leaves;
    if (phase === 'camera') return LayerCssVariable.CAMERA_CLOCK;
    return clock.starts;
  }
}
