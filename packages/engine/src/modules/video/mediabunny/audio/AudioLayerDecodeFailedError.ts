/**
 * Raised when the source of an audio layer cannot be decoded, by any of
 * the ways tried. `layerId` names the layer; why it failed is in
 * `cause`.
 *
 * The `.name` string is set explicitly, and exposed as `ERROR_NAME` on
 * the class, so consumers can recognise the failure across a boundary
 * that preserves string fields but not class identity — a Worker, or a
 * browser driven from outside the page.
 */
export class AudioLayerDecodeFailedError extends Error {
  static readonly ERROR_NAME = 'AudioLayerDecodeFailedError';
  readonly name = AudioLayerDecodeFailedError.ERROR_NAME;

  constructor(readonly layerId: string, options: { cause: unknown }) {
    super(`The source of audio layer ${layerId} could not be decoded.`, options);
  }
}
