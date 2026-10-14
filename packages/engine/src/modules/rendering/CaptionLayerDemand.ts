import type { Document } from '@modules/document/Document';
import type { Segment } from '@modules/document/Segment';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { SegmentSubtreeDecomposer } from '@modules/rendering/subtitle/SegmentSubtreeDecomposer';
import { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import { CaptionLayer } from '@modules/rendering/types/CaptionLayer';

/**
 * Which caption layers a document paints in, and which styles paint in
 * each — asked of the same decomposer the renderer splits segments
 * with, so a layer is opened exactly when some subtree will paint in it.
 */
export class CaptionLayerDemand {

  constructor(private readonly decomposer: SegmentSubtreeDecomposer) {}

  /**
   * Every layer some segment of `document` paints in, mapped to the
   * kinds of the styles that do. The base layer is always present,
   * with every kind: it is where captions paint unless told otherwise.
   * Sections whose kind has no style are skipped, as the renderer
   * skips them.
   */
  layersPaintedBy(
    document: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
  ): ReadonlyMap<CaptionLayer, ReadonlySet<string>> {
    const kindsByLayer = new Map<CaptionLayer, Set<string>>([[CaptionLayer.BASE, new Set(Object.keys(styles))]]);
    for (const section of document.sections) {
      const style = styles[section.kind];
      if (!style) continue;
      for (const segment of section.segments) {
        for (const layer of this.layersOf(segment, style)) {
          const kinds = kindsByLayer.get(layer) ?? new Set<string>();
          kinds.add(section.kind);
          kindsByLayer.set(layer, kinds);
        }
      }
    }
    return kindsByLayer;
  }

  private layersOf(segment: Segment, style: SubtitleStyle): ReadonlySet<CaptionLayer> {
    return this.decomposer.decompose(
      segment,
      style.subtreeOverrides ?? ElementRenderOverrides.empty(),
      style.decorationPlacements ?? new Map(),
      style.segmentOverrides?.get(segment.id),
    ).layers;
  }
}
