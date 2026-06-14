/**
 * Time-derived CSS custom properties this app exposes to SVG filter
 * authors via their `var(--name)` placeholders. Each entry has a
 * recipe documented inline; the values are emitted by the sheet-side
 * scope provider on every render frame.
 */
export enum SvgFilterRuntimeVariable {
  /** Integer ticking 30 times per second — `floor(currentTime * 30)`. Stable seed for `feTurbulence`. */
  TICK_30 = '--tscaps-tick',
  /** Integer ticking 60 times per second — `floor(currentTime * 60)`. */
  TICK_60 = '--tscaps-tick-60',
  /** Float seconds since playback origin. */
  CURRENT_TIME = '--tscaps-time',
}
