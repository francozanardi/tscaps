// The longest side an image field keeps: an avatar or a logo, never a photo to fill the frame.
const MAX_SIDE_PX = 256;
const QUALITY = 0.86;

/**
 * Turns a picked image file into what an image field holds: the image
 * scaled down to fit 256 px on its longest side, as a `data:` URL —
 * WebP where the browser encodes it, PNG otherwise. Rejects for a file
 * the browser cannot decode as an image.
 */
export class GraphicImageEncoder {
  async encode(file: Blob): Promise<string> {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', QUALITY);
    } finally {
      bitmap.close();
    }
  }
}
