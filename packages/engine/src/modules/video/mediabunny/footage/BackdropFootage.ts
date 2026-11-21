import type { FootagePicture } from '@modules/video/FootagePicture';
import type { OpenedFootage } from '@modules/video/mediabunny/footage/OpenedFootage';

/**
 * {@link OpenedFootage} of a backdrop layer, which has no picture of its
 * own: the compositor draws the frame beneath the layer in its place.
 * Every moment answers this placeholder, which draws nothing, so a
 * backdrop layer is composed like any layer holding a picture.
 */
export class BackdropFootage implements OpenedFootage, FootagePicture {
  readonly width = 1;
  readonly height = 1;

  pictureAt(): Promise<FootagePicture | null> {
    return Promise.resolve(this);
  }

  draw(): void {}

  close(): Promise<void> {
    return Promise.resolve();
  }
}
