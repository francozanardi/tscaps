import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { SHOT_LAYER_LAYOUT_FIELD_IDS, type ShotLayerLayoutFields } from '@core/shots/domain/ShotLayerLayoutFields';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';

/**
 * Lays a layer out: writes a layout as the layer's fields, each with the
 * declaration it writes into the layer's CSS, the way a caption
 * element's field is written.
 *
 * A layout writes its own fields and takes back the ones it does not
 * read, so a layer switched from a box to the full frame keeps no
 * centre, no width and no padding behind. Everything else the layer's
 * CSS holds — its motion, anything written by hand — stays as it is.
 */
export class ShotLayerLayoutWriter {
  constructor(
    private readonly catalog: StyledElementCatalog,
    private readonly controls: ElementControlCssWriter,
    private readonly layouts: ShotLayerLayoutFields,
  ) {}

  /**
   * `partition` with the layer `layerId` laid out by `placement`,
   * clamped first; no other layer moves, and the last edited layouts
   * stay as they are. The same partition where no layer has that id,
   * the placement names no layout, or the layer is laid out so already.
   */
  withLayout(partition: ShotPartition, layerId: string, placement: ShotLayerPlacement): ShotPartition {
    const sanitized = this.layouts.sanitize(placement);
    if (sanitized === null || partition.findLayer(layerId) === null) return partition;
    if (this.layouts.isSame(partition.placementOf(layerId), sanitized)) return partition;
    return partition.withLayerStyles(this.written(partition.layerStyles, layerId, sanitized));
  }

  /** `styles` with `layerId`'s layout fields, and the CSS they write, saying `placement` as given. */
  written(styles: ElementStyles, layerId: string, placement: ShotLayerPlacement): ElementStyles {
    const values = this.layouts.valuesOf(placement);
    let written = styles;
    for (const fieldId of SHOT_LAYER_LAYOUT_FIELD_IDS) {
      const control = this.catalog.requireControl('layer', fieldId);
      const css = written.get(layerId)?.css ?? '';
      const value = values[fieldId];
      if (value !== undefined) {
        written = written.withField(layerId, 'layer', fieldId, value, this.controls.write(css, control, value));
      } else if (written.get(layerId)?.fields?.[fieldId] !== undefined) {
        written = written.withoutField(layerId, 'layer', fieldId, this.controls.remove(css, control));
      }
    }
    return written;
  }
}
