import type { VideoConversionEstimate } from '@core/videos/domain/VideoConverter';

/**
 * Whether converting a video is expected to need more memory than a
 * computer with 8 GB leaves a browser tab.
 *
 * Only a browser that keeps each decoded frame until the conversion
 * ends is at risk. Firefox does: its tab grew by about 2 bytes for
 * every pixel of every frame decoded, to 5.7 GB for a minute of
 * portrait 1080p, and gave it back only once the conversion was done.
 * Chromium frees each frame as it goes and stays near 1 GB.
 */
export class VideoConversionMemoryRisk {

  private static readonly RETAINED_BYTES_PER_DECODED_PIXEL = 2;
  /** About 17 seconds of portrait 1080p at 30 frames a second. */
  private static readonly HIGH_RETAINED_BYTES = 2 * 1024 ** 3;

  constructor(private readonly browserKeepsDecodedFrames: boolean) {}

  isHigh(estimate: VideoConversionEstimate): boolean {
    if (!this.browserKeepsDecodedFrames) return false;
    const retainedBytes = estimate.decodedPixels * VideoConversionMemoryRisk.RETAINED_BYTES_PER_DECODED_PIXEL;
    return retainedBytes > VideoConversionMemoryRisk.HIGH_RETAINED_BYTES;
  }
}
