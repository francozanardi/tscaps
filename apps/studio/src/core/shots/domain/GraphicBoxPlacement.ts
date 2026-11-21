import type { GraphicBox } from '@core/graphics/domain/GraphicBox';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';

// Kept off the frame's edges as any box over the video is, as a share of its shorter side.
const BOX_PADDING = 0.04;

/**
 * The layout a graphic's box becomes on its shot: the full frame, or a
 * box floating over the video in the graphic's own shape, filled, so
 * nothing of it is cropped, its corners square — the graphic draws its
 * own — and back.
 */
export class GraphicBoxPlacement {
  placementOf(box: GraphicBox): ShotLayerPlacement {
    if (box.kind === 'full') return { kind: 'full', fit: 'cover' };
    return {
      kind: 'inset',
      subject: 'asset',
      centerX: box.centerX,
      centerY: box.centerY,
      width: box.width,
      aspectRatio: null,
      padding: BOX_PADDING,
      cornerRadius: 0,
      fit: 'cover',
    };
  }

  /**
   * The box `placement` keeps a graphic in: the full frame, or a box at its
   * centre and width. A split, which a box cannot say, reads as the full
   * frame.
   */
  boxOf(placement: ShotLayerPlacement): GraphicBox {
    if (placement.kind !== 'inset') return { kind: 'full' };
    return { kind: 'box', centerX: placement.centerX, centerY: placement.centerY, width: placement.width };
  }
}
