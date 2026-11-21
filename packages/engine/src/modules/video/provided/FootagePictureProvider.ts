import type { ProvidedFootagePictures } from '@modules/video/provided/ProvidedFootagePictures';

/**
 * Where a layer's pictures come from when no file holds them: the caller
 * draws each moment itself and hands the picture over.
 *
 * Opened once for each stretch the layer is read over (an export's run,
 * a preview's pass), possibly more than once at a time, and each opening
 * is closed by whoever opened it. Rejects when the pictures cannot be
 * had at all.
 */
export interface FootagePictureProvider {
  /**
   * `scale` is how large the pictures are needed, as a share of their
   * full size: 1 for the pictures as they are, less for a reader that
   * draws them smaller and has no use for the pixels in between. A
   * picture shows the same thing at any scale.
   */
  open(scale: number): Promise<ProvidedFootagePictures>;
}
