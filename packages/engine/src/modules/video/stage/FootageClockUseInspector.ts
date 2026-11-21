/** Says how a stylesheet reads the layer clock (`CssVariable.LAYER_STARTS`, `LAYER_ENDS`). */
export interface FootageClockUseInspector {
  /**
   * Whether `css` reads the clock only where an animation takes its
   * timing, and only added to: on its own, or as what a `calc()` adds
   * to or takes from. True also for a stylesheet that never reads it.
   *
   * False whenever that cannot be told for certain, and for any
   * stylesheet that reads the clock anywhere else: a length, an opacity,
   * a keyframe, a multiple of it.
   */
  readsClockOnlyToTimeAnimations(css: string): boolean;
}
