import type { ElementKind } from '@core/elements/domain/ElementKind';

/** What the checks need to know about the element the CSS is written against. */
export interface ElementCssContext {
  /** The kind of element the CSS is written against. */
  readonly kind: ElementKind;
  /** The variable an animation on this element should take its delay from. */
  readonly timingVariable: string;
  /** The variable an animation that plays as the element leaves anchors to: the moment it stops. */
  readonly exitTimingVariable: string;
}
