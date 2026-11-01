/** What converting a source is expected to take, read from its container without decoding it. */
export interface VideoConversionEstimate {
  readonly seconds: number;
  /** Every frame's pixels added up: how much picture the conversion decodes. */
  readonly decodedPixels: number;
}

/**
 * Re-encodes a source this browser cannot decode into an H.264 MP4 it
 * can, at the source's own size and frame rate, with its audio copied.
 * The result is meant to replace the source for everything after it:
 * preview, transcription, storage and export.
 */
export interface VideoConverter {
  /** `null` when the source's container cannot be read. */
  estimate(source: File): Promise<VideoConversionEstimate | null>;

  /**
   * Resolves to the converted file, named after the source. Reports
   * progress in `[0, 1]`. Rejects with `VideoConversionFailedError`.
   */
  convert(source: File, onProgress: (fraction: number) => void): Promise<File>;
}
