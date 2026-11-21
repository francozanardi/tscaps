/**
 * The input's own audio could not be decoded to be mixed, by any path
 * this browser offers. `cause` holds the error of the last path tried;
 * the message names every path's error.
 */
export class InputAudioDecodeFailedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'InputAudioDecodeFailedError';
  }
}
