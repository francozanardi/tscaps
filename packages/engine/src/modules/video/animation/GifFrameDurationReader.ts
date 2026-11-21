import type { AnimationFrameDurationReader, AnimationTiming } from '@modules/video/animation/AnimationFrameDurationReader';
import type { GifFileReader } from '@modules/video/animation/GifFileReader';

// A GIF asking for (almost) no delay is held for a tenth of a second by
// browsers, which is what its author saw.
const SHORTEST_HONOURED_DELAY_SEC = 0.02;
const DELAY_STANDING_IN_SEC = 0.1;

/**
 * {@link AnimationFrameDurationReader} for GIFs, which state each
 * frame's delay ahead of the frame, so no pixel is decoded.
 *
 * A delay under two hundredths of a second is read as a tenth, the way
 * browsers show it. How many times the GIF runs is its NETSCAPE2.0 loop
 * count, read the way browsers read it: none at all plays once, 0 loops
 * forever, and N repeats N times after the first run. A file that ends
 * early answers the frames read up to there; bytes that are not a GIF
 * answer null.
 */
export class GifFrameDurationReader implements AnimationFrameDurationReader {
  constructor(private readonly files: GifFileReader) {}

  read(bytes: Uint8Array): AnimationTiming | null {
    const file = this.files.read(bytes);
    if (file === null) return null;
    return {
      frameDurationsSec: file.frames.map((frame) => this.honoured((frame.delayHundredths ?? 0) / 100)),
      playCount: file.loopCount === null ? 1 : file.loopCount === 0 ? Infinity : file.loopCount + 1,
    };
  }

  private honoured(delaySec: number): number {
    return delaySec < SHORTEST_HONOURED_DELAY_SEC ? DELAY_STANDING_IN_SEC : delaySec;
  }
}
