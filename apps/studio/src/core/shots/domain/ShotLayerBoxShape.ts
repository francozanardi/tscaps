import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';

// Shapes this close crop less than a pixel of any box there is.
const SAME_SHAPE_TOLERANCE = 1e-3;

/**
 * The shape of the box a shot layer's layout puts its file in, on a
 * frame of a given shape, and the axis a file filling it is cropped on.
 * Pure arithmetic over the layout's settings, as the framework lays the
 * box out.
 */
export class ShotLayerBoxShape {
  /**
   * The axis a file filling its box is cropped on, laid out by
   * `placement` on a frame of `frameAspectRatio`: `x` for a file wider
   * than its box, `y` for a taller one. Null where nothing is cropped —
   * a file fitted inside its box, or of its box's shape — or where a
   * shape is not known.
   */
  croppedAxisOf(placement: ShotLayerPlacement, frameAspectRatio: number | null, assetAspectRatio: number | null): 'x' | 'y' | null {
    const box = this.aspectRatioOf(placement, frameAspectRatio, assetAspectRatio);
    if (placement.fit !== 'cover' || box === null || assetAspectRatio === null) return null;
    if (Math.abs(assetAspectRatio / box - 1) < SAME_SHAPE_TOLERANCE) return null;
    return assetAspectRatio > box ? 'x' : 'y';
  }

  /**
   * The width over the height of the box `placement` puts its file in,
   * on a frame of `frameAspectRatio`: the frame's for the whole frame,
   * or where the video floats over the file; the split's part less its
   * padding; a floating box's own shape, the file's where it has none.
   */
  aspectRatioOf(placement: ShotLayerPlacement, frameAspectRatio: number | null, assetAspectRatio: number | null): number | null {
    if (frameAspectRatio === null || !(frameAspectRatio > 0)) return null;
    switch (placement.kind) {
      case 'full':
        return frameAspectRatio;
      case 'inset':
        return placement.subject === 'video' ? frameAspectRatio : placement.aspectRatio ?? assetAspectRatio;
      case 'split': {
        // On a frame one unit tall: a split cuts a frame wider than tall across, any other one down.
        const gap = 2 * placement.padding * Math.min(frameAspectRatio, 1);
        const across = frameAspectRatio > 1;
        const width = (across ? placement.assetRatio * frameAspectRatio : frameAspectRatio) - gap;
        const height = (across ? 1 : placement.assetRatio) - gap;
        return width > 0 && height > 0 ? width / height : null;
      }
    }
  }
}
