import type { InlineStyleMap } from '@modules/rendering/types/InlineStyleMap';
import { SvgFilterScope } from '@modules/svg-filter/SvgFilterScope';
import type { SvgFilterScoper } from '@modules/svg-filter/SvgFilterScoper';
import type { SvgFilterLengthResolver } from '@modules/svg-filter/SvgFilterLengthResolver';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';

export interface FilterMaterialization {
  defs: string;
  bindings: ReadonlyMap<string, string>;
}

/**
 * Materializes the SVG `<filter>` defs declared by a style's filter
 * bundle for one render tile. Resolves each filter's length units
 * against the render-surface pixel factors, layers the engine-
 * injected vars onto the consumer's scope, and rebinds local ids to
 * scope-unique ids so two tiles using the same source filter don't
 * collide in the sprite-sheet SVG.
 *
 * Returns empty defs and empty bindings when the style declares no
 * filters.
 */
export class SvgFilterMaterializer {

  constructor(
    private readonly svgFilterScoper: SvgFilterScoper,
    private readonly svgFilterLengthResolver: SvgFilterLengthResolver,
    private readonly renderHeightPx: number,
  ) {}

  materialize(
    style: PreparedStyle,
    t: number,
    engineVars: InlineStyleMap,
    nextUid: () => number,
  ): FilterMaterialization {
    const definitions = style.filters.definitions;
    if (definitions.isEmpty()) return { defs: '', bindings: new Map() };
    const context = { currentTime: t, renderHeightPx: this.renderHeightPx };
    const consumerScope = style.filters.scopeProvider.scopeAt(context);
    const scope = consumerScope.with(SvgFilterScope.fromEntries(Object.entries(engineVars)));
    const lengthFactors = style.filters.scopeProvider.lengthFactorsAt(context);
    const { idByLocal, bindings } = this.svgFilterScoper.scopeIds(
      definitions.ids,
      `${style.scopeClass}-${nextUid()}`,
    );
    const defs = definitions.filters
      .map((filter) => {
        const body = this.svgFilterLengthResolver.resolve(filter.materialize(scope), lengthFactors);
        return `<filter id="${idByLocal.get(filter.id)}">${body}</filter>`;
      })
      .join('');
    return { defs, bindings };
  }
}
