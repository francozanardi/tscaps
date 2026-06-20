import type { ScopedRenderOverride } from '@modules/rendering/types/ScopedRenderOverride';

/**
 * Render-time overrides indexed by element id.
 * The bitmap renderer looks up each element by
 * id and layers the resolved override over the style's root defaults.
 */
export class ElementRenderOverrides {
  static empty(): ElementRenderOverrides {
    return new ElementRenderOverrides(new Map());
  }

  static fromEntries(
    entries: ReadonlyArray<readonly [string, ScopedRenderOverride]>,
  ): ElementRenderOverrides {
    return new ElementRenderOverrides(new Map(entries));
  }

  private constructor(
    private readonly entries: ReadonlyMap<string, ScopedRenderOverride>,
  ) {}

  isEmpty(): boolean {
    return this.entries.size === 0;
  }

  get(elementId: string): ScopedRenderOverride | undefined {
    return this.entries.get(elementId);
  }
}
