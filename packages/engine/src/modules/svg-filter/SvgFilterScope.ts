/**
 * Immutable lookup of CSS custom-property names to their resolved
 * values. `SvgFilter.materialize` consults it when substituting
 * `var(--name)` references in a filter body.
 *
 * Built by `fromEntries` and extended by `with` — both produce new
 * instances; the underlying map is never mutated in place.
 */
export class SvgFilterScope {
  static empty(): SvgFilterScope {
    return new SvgFilterScope(new Map());
  }

  static fromEntries(entries: Iterable<readonly [string, string]>): SvgFilterScope {
    return new SvgFilterScope(new Map(entries));
  }

  private constructor(private readonly entries: ReadonlyMap<string, string>) {}

  resolve(name: string): string | undefined {
    return this.entries.get(name);
  }

  /** Returns a new scope whose entries override matching names in this one. */
  with(additions: SvgFilterScope): SvgFilterScope {
    return new SvgFilterScope(new Map([...this.entries, ...additions.entries]));
  }
}
