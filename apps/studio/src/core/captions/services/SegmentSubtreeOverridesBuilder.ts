import { CaptionStacking, ElementRenderOverrides, type ScopedRenderOverride, type Segment } from '@tscaps/engine';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { ElementBlendResolver } from '@core/elements/services/ElementBlendResolver';

/** The render overrides one segment and the elements inside it carry. */
export interface SegmentSubtreeOverrides {
  readonly segment: ScopedRenderOverride | undefined;
  /** Its words and glyphs, by id: where each was put, and the stacking and blend mode of the layer it paints in. */
  readonly subtree: ElementRenderOverrides;
}

/**
 * The overrides of one segment, in the shape the renderer's own
 * decomposer reads, so the preview and the export split it into exactly
 * the same subtrees.
 *
 * Carries the parts that decide that split: where an element was put,
 * and the layer each subtree paints in — its blend, and where it is
 * stacked relative to the top layer. An element under the top layer
 * while its segment is not — a word behind the actor in a caption that
 * stays in front — is stacked under it, and its segment over it, so
 * that only the word is occluded.
 */
export class SegmentSubtreeOverridesBuilder {

  constructor(private readonly blendResolver: ElementBlendResolver) {}

  /** `elementsUnderTopLayer` holds the words and glyphs that paint under the top layer while their segment does not. */
  build(
    segment: Segment,
    elementStyles: ElementStyles,
    elementsUnderTopLayer: ReadonlySet<string>,
  ): SegmentSubtreeOverrides {
    const entries: Array<readonly [string, ScopedRenderOverride]> = [];
    let splitsAcrossTopLayer = false;
    for (const line of segment.lines) {
      for (const word of line.words) {
        const elementIds = word.decoration ? [word.id, word.decoration.id] : [word.id];
        for (const elementId of elementIds) {
          const under = elementsUnderTopLayer.has(elementId);
          if (under) splitsAcrossTopLayer = true;
          const entry = this.entryFor(elementId, elementStyles, under);
          if (entry) entries.push([elementId, entry]);
        }
      }
    }
    const blendMode = this.blendResolver.blendModeOf(segment.id, elementStyles);
    const segmentOverride: ScopedRenderOverride = {
      ...(blendMode ? { blendMode } : {}),
      ...(splitsAcrossTopLayer ? { stacking: CaptionStacking.OVER_TOP_LAYER } : {}),
    };
    return {
      segment: Object.keys(segmentOverride).length > 0 ? segmentOverride : undefined,
      subtree: ElementRenderOverrides.fromEntries(entries),
    };
  }

  private entryFor(elementId: string, elementStyles: ElementStyles, underTopLayer: boolean): ScopedRenderOverride | null {
    const placement = elementStyles.placementOf(elementId);
    const blendMode = this.blendResolver.blendModeOf(elementId, elementStyles);
    if (!placement && !blendMode && !underTopLayer) return null;
    return {
      ...(placement ? { alignment: placement } : {}),
      ...(blendMode ? { blendMode } : {}),
      ...(underTopLayer ? { stacking: CaptionStacking.UNDER_TOP_LAYER } : {}),
    };
  }
}
