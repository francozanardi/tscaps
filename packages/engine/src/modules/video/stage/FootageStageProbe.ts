/** A rect of a stage in its pixels, as the stage resolved four lengths. */
export interface FootageStagePixelRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Has a stage resolve what a stylesheet wrote as a length of it: a value
 * a custom property holds unevaluated — a `calc()`, a share of the
 * stage, a container unit — comes back in pixels of that stage.
 *
 * Bound to one stage, whose size and stylesheet do not change while it
 * is asked, so one value always resolves to the same pixels there.
 */
export interface FootageStageProbe {
  /**
   * The pixels the stage makes of `value` written as a width: a
   * percentage is of the stage's width, and CSS keeps a width from going
   * below zero.
   */
  width(value: string): number;

  /**
   * The pixels the stage makes of a rect placed by its four sides:
   * `left` and `width` against the stage's width, `top` and `height`
   * against its height.
   */
  rect(left: string, top: string, width: string, height: string): FootageStagePixelRect;
}
