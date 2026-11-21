/**
 * Why a file was not added: it is wider or taller than a file may be.
 * Travels as the `cause` of the import failure.
 */
export class MediaAssetTooManyPixelsError extends Error {
  readonly name = 'MediaAssetTooManyPixelsError';

  constructor(
    readonly widthPx: number,
    readonly heightPx: number,
    readonly maxSidePx: number,
  ) {
    super(`The file is ${widthPx}×${heightPx} px, past the ${maxSidePx} px limit on either side`);
  }
}
