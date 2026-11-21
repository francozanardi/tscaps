import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import type { ElementKind } from '@core/elements/domain/ElementKind';

/**
 * The motions an element can be given, in the order the animation
 * library lists them: its entrances, its exits, and a shot layer's
 * cameras, each compiled against the clock it plays on.
 */
export class ElementAnimationCatalog {
  constructor(private readonly presets: ReadonlyArray<ElementAnimationPreset>) {}

  all(): ReadonlyArray<ElementAnimationPreset> {
    return this.presets;
  }

  /**
   * The motions that exist for one kind of element, at every end.
   *
   * A motion the library writes for a single kind is offered for that
   * kind alone, and asking for another gets a shorter list rather than
   * a motion that would be applied against a clock it was never
   * compiled for.
   */
  forKind(kind: ElementKind): ReadonlyArray<ElementAnimationPreset> {
    return this.presets.filter((preset) => preset.kinds.includes(kind));
  }

  /**
   * The motions that exist for one kind of element on one of its
   * clocks: its entrances on the clock of its start, its exits on the
   * clock it leaves on.
   */
  forClock(kind: ElementKind, timingVariable: string): ReadonlyArray<ElementAnimationPreset> {
    return this.forKind(kind).filter((preset) => preset.declarationsByTimingVariable[timingVariable] !== undefined);
  }

  byId(id: string): ElementAnimationPreset | null {
    return this.presets.find((preset) => preset.id === id) ?? null;
  }

  /**
   * The declarations that give an element this motion while anchored
   * to `timingVariable`, less the `animation` that plays it. Throws when
   * the motion was never compiled against that clock, which means the
   * artifact and the element kinds have gone out of step.
   */
  declarationsFor(preset: ElementAnimationPreset, timingVariable: string): string {
    const declarations = preset.declarationsByTimingVariable[timingVariable];
    if (declarations === undefined) {
      throw new Error(`Animation "${preset.id}" was not built for elements anchored to ${timingVariable}.`);
    }
    return declarations;
  }

  /**
   * The `animation` shorthand that plays this motion while anchored to
   * `timingVariable`. Throws for one compiled without one — a shot
   * layer's, whose declarations publish their own — or never compiled
   * against that clock.
   */
  animationFor(preset: ElementAnimationPreset, timingVariable: string): string {
    const shorthand = preset.animationByTimingVariable[timingVariable];
    if (shorthand === undefined) {
      throw new Error(`Animation "${preset.id}" plays through no animation of its own on ${timingVariable}.`);
    }
    return shorthand;
  }
}
