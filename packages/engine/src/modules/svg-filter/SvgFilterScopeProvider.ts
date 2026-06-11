import type { SvgFilterScope } from '@modules/svg-filter/SvgFilterScope';

/**
 * Frame-level context the renderer passes when resolving the
 * variable scope a filter materializes against. Carries the timestamp
 * being rendered and the height of the render target in user-space
 * px; the renderer adds its own render-time variables (video frame,
 * dimensions) on top of the returned scope before passing it to
 * `SvgFilter.materialize`.
 *
 * `renderHeightPx` is the height of the render target in px. The same
 * content is rendered into targets of different heights, so
 * font/viewport-relative filter lengths must be resolved against it
 * per render — see `SvgFilterLengthResolver`.
 */
export interface SvgFilterRenderContext {
  readonly currentTime: number;
  readonly renderHeightPx: number;
}

/**
 * Multipliers that convert font/viewport-relative lengths to
 * user-space px for one render context. `SvgFilterLengthResolver`
 * applies them to `em` / `cqh` tokens in a materialized filter body.
 */
export interface SvgFilterLengthFactors {
  /** User-space px for one `em` at the resolved font-size. */
  readonly pxPerEm: number;
  /** User-space px for one `cqh` (1% of the render target height). */
  readonly pxPerCqh: number;
}

/**
 * Strategy that resolves the variable scope for one render context.
 * The renderer invokes `scopeAt` once per output tile.
 *
 * Implementations whose scope does not depend on the context return
 * the same scope on every call. Implementations whose scope varies
 * with `currentTime` (typically deriving integer ticks from it)
 * return a scope whose entries change per call.
 *
 * `lengthFactorsAt` supplies the px-per-`em` / px-per-`cqh`
 * multipliers for the same context. SVG filter primitive attributes
 * (`radius`, `stdDeviation`, `dx`, …) accept neither relative units
 * nor `calc()`, so a filter that must track text size is authored in
 * `em`/`cqh` and resolved to px at render time. The px-per-`em`
 * factor depends on the consumer's font-size, which the engine does
 * not know — hence it comes from the provider, while the engine
 * supplies only the render height via the context.
 */
export interface SvgFilterScopeProvider {
  scopeAt(context: SvgFilterRenderContext): SvgFilterScope;
  lengthFactorsAt(context: SvgFilterRenderContext): SvgFilterLengthFactors;
}
