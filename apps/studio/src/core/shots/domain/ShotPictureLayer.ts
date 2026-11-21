import type { ShotFileLayer } from '@core/shots/domain/ShotLayer';

/** A layer showing a picture or a GIF on top of a shot, with which of the two its file is. */
export interface ShotPictureLayer {
  readonly layer: ShotFileLayer;
  readonly kind: 'image' | 'gif';
}
