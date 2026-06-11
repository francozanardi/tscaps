import type { SvgFilter } from '@modules/svg-filter/SvgFilter';

/**
 * Immutable list of `<filter>` declarations that a stylesheet may
 * reference via `filter: url(#id)`. Each entry carries the filter's
 * local id (the value inside `url(#…)`) and an XML body whose
 * `var(--name)` placeholders get resolved at render time.
 */
export class SvgFilterDefinitions {
  static empty(): SvgFilterDefinitions {
    return new SvgFilterDefinitions([]);
  }

  constructor(private readonly _filters: ReadonlyArray<SvgFilter>) {}

  get filters(): ReadonlyArray<SvgFilter> {
    return this._filters;
  }

  get ids(): ReadonlySet<string> {
    return new Set(this._filters.map((f) => f.id));
  }

  isEmpty(): boolean {
    return this._filters.length === 0;
  }
}
