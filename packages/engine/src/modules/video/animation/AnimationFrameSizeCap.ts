/** A size in pixels. */
export interface AnimationFrameSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The largest an animation's frames are held at: no longer than
 * `maxLongestSidePx` on their longest side, keeping their shape.
 * `Infinity` holds every frame at its own size.
 */
export class AnimationFrameSizeCap {
  constructor(private readonly maxLongestSidePx: number = Infinity) {}

  /** `width` × `height` scaled down, keeping its shape, until its longest side is within the cap; never under one pixel. */
  fit(width: number, height: number): AnimationFrameSize {
    const longest = Math.max(width, height);
    if (longest <= this.maxLongestSidePx) return { width, height };
    const scale = this.maxLongestSidePx / longest;
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  }
}
