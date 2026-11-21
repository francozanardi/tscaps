/**
 * Why a file was not added: it is none of the kinds the editor takes —
 * a video, a PNG, JPEG or WebP picture, or a GIF. Travels as the `cause`
 * of the import failure.
 */
export class MediaAssetUnsupportedTypeError extends Error {
  readonly name = 'MediaAssetUnsupportedTypeError';

  constructor(readonly mimeType: string) {
    super(`Files of type '${mimeType || 'unknown'}' cannot be added`);
  }
}
