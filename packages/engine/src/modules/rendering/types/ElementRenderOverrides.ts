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

  /** Every override held, for a consumer that has to look at all of them rather than one. */
  values(): Iterable<ScopedRenderOverride> {
    return this.entries.values();
  }

  /**
   * A new instance layering `other` over this one: elements present in
   * only one side keep their entry; for elements present in both,
   * `other`'s inline styles merge key-by-key over this one's, and its
   * alignment, classes, stacking and blend mode replace them when present.
   */
  mergedWith(other: ElementRenderOverrides): ElementRenderOverrides {
    if (other.isEmpty()) return this;
    if (this.isEmpty()) return other;
    const merged = new Map(this.entries);
    for (const [elementId, override] of other.entries) {
      const base = merged.get(elementId);
      merged.set(elementId, base ? this.mergeOverride(base, override) : override);
    }
    return new ElementRenderOverrides(merged);
  }

  private mergeOverride(base: ScopedRenderOverride, layer: ScopedRenderOverride): ScopedRenderOverride {
    const inlineStyles = base.inlineStyles || layer.inlineStyles
      ? { ...base.inlineStyles, ...layer.inlineStyles }
      : undefined;
    return {
      ...(inlineStyles ? { inlineStyles } : {}),
      ...((layer.alignment ?? base.alignment) ? { alignment: layer.alignment ?? base.alignment } : {}),
      ...((layer.classes ?? base.classes) ? { classes: layer.classes ?? base.classes } : {}),
      ...((layer.stacking ?? base.stacking) ? { stacking: layer.stacking ?? base.stacking } : {}),
      ...((layer.blendMode ?? base.blendMode) ? { blendMode: layer.blendMode ?? base.blendMode } : {}),
    };
  }
}
