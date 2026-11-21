import type { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';

/**
 * What one kind of addressable element can be told about itself.
 *
 * Four answers, and they are independent. Which fields it offers is
 * the list; how those fields reach the painted text is the surface;
 * which animations it can be given is a separate list, because an
 * element that wraps words can be told how they enter as well as how
 * it does; whether it can be lifted out of the line and anchored in
 * the frame is none of them, because a placement never becomes a
 * declaration and has nothing in the CSS to lose to.
 *
 * A new kind of element — a GIF, a widget — is a new class here. It
 * reuses whichever fields already say what it needs, and nothing about
 * the fields, the store or the panels has to learn its name.
 */
export interface StyledElementType {
  readonly surface: ElementStyleSurface;

  /** In the order they are offered, which is the order they are drawn. */
  fields(): ReadonlyArray<ElementField>;

  /**
   * Which of its parts can be given an animation, and at which end of
   * their life, in the order they are offered. An element holding no
   * words offers only itself.
   */
  animationScopes(): ReadonlyArray<ElementAnimationScope>;

  /** Whether the element can be taken out of the line flow and anchored in the frame. */
  canBePlaced(): boolean;
}
