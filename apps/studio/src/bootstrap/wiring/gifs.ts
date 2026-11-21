import {
  FallbackAnimatedImageOpener,
  GifFileReader,
  GifFrameDurationReader,
  GifLzwDecoder,
  ImageDecoderGifOpener,
  ScriptGifOpener,
  type AnimatedImageOpener,
} from '@tscaps/engine/advanced';

/**
 * Builds the opener every GIF is played through: the browser's own
 * `ImageDecoder` where it has one that reads the file, the engine's
 * script decoder otherwise; it rejects only where neither can. Frames
 * are held no larger than `maxLongestSidePx` on their longest side.
 */
export function buildGifOpener(maxLongestSidePx: number = Infinity): AnimatedImageOpener {
  const files = new GifFileReader();
  const durations = new GifFrameDurationReader(files);
  return new FallbackAnimatedImageOpener([
    new ImageDecoderGifOpener(durations, maxLongestSidePx),
    new ScriptGifOpener(files, durations, new GifLzwDecoder(), maxLongestSidePx),
  ]);
}
