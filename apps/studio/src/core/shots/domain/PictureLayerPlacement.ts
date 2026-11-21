import type { InsetShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';

/**
 * Where a picture or a GIF sits until another placement is applied to
 * every picture: a box half the frame wide, centred across and in the
 * upper part of the frame, in the picture's own shape, nothing of it
 * cropped and its corners square — a logo or a sticker keeps its
 * outline.
 */
export const PICTURE_LAYER_PLACEMENT: InsetShotLayerPlacement = {
  kind: 'inset', subject: 'asset',
  centerX: 0.5,
  centerY: 0.3,
  width: 0.5,
  aspectRatio: null,
  padding: 0.04,
  cornerRadius: 0,
  fit: 'contain',
};
