import { SvgFilterScope, type SvgFilterRenderContext, type SvgFilterScopeProvider, type SvgFilterLengthFactors } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { SvgFilterRuntimeVariable } from '@core/templates/domain/definition/SvgFilterRuntimeVariable';

/**
 * Resolves the variable scope SVG filters in this sheet's template
 * use at render time. Merges two sources:
 *  - one entry per style control, keyed `--tscaps-<id>` with the
 *    raw stored value,
 *  - the time-derived helpers declared in `SvgFilterRuntimeVariable`,
 *    computed from the render context's `currentTime`.
 *
 * Values are raw strings (no CSS escaping, no unit suffix) because
 * SVG filter attributes consume plain tokens, not CSS values.
 *
 * `lengthFactorsAt` resolves the `em` / `cqh` units a filter author
 * writes for size-tracking lengths (outline thickness, glow radius)
 * into the px multipliers the engine's length resolver needs. Font
 * size lives in the sheet's typography (in `cqh`), so this is where
 * the per-render render height meets it.
 */
export class SheetSvgFilterScopeProvider implements SvgFilterScopeProvider {
  constructor(private readonly sheet: Sheet) {}

  scopeAt(context: SvgFilterRenderContext): SvgFilterScope {
    return SvgFilterScope.fromEntries([
      ...this.styleControlEntries(),
      ...this.runtimeEntries(context.currentTime),
    ]);
  }

  lengthFactorsAt(context: SvgFilterRenderContext): SvgFilterLengthFactors {
    const pxPerCqh = context.renderHeightPx / 100;
    return {
      pxPerCqh,
      pxPerEm: this.sheet.typographyConfig.fontSize * pxPerCqh,
    };
  }

  private styleControlEntries(): ReadonlyArray<readonly [string, string]> {
    return Object.entries(this.sheet.styleValues.values).map(([id, value]) => [`--tscaps-${id}`, String(value)] as const);
  }

  private runtimeEntries(currentTime: number): ReadonlyArray<readonly [string, string]> {
    return [
      [SvgFilterRuntimeVariable.TICK_30, String(Math.floor(currentTime * 30))],
      [SvgFilterRuntimeVariable.TICK_60, String(Math.floor(currentTime * 60))],
      [SvgFilterRuntimeVariable.CURRENT_TIME, String(currentTime)],
    ];
  }
}
