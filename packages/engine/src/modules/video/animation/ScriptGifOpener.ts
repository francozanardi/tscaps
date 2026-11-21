import { AnimatedImageFootage } from '@modules/video/animation/AnimatedImageFootage';
import { AnimatedImageOpenFailedError } from '@modules/video/animation/AnimatedImageOpenFailedError';
import type { AnimatedImageOpener } from '@modules/video/animation/AnimatedImageOpener';
import type { AnimationFrameDurationReader } from '@modules/video/animation/AnimationFrameDurationReader';
import { AnimationFrameSizeCap } from '@modules/video/animation/AnimationFrameSizeCap';
import { AnimationFrameTimeline } from '@modules/video/animation/AnimationFrameTimeline';
import type { DrawableFootage } from '@modules/video/animation/DrawableFootage';
import { GifFrameComposer } from '@modules/video/animation/GifFrameComposer';
import type { GifFileReader } from '@modules/video/animation/GifFileReader';
import type { GifLzwDecoder } from '@modules/video/animation/GifLzwDecoder';
import { ScriptGifAnimationFrameDecoder } from '@modules/video/animation/ScriptGifAnimationFrameDecoder';

/**
 * {@link AnimatedImageOpener} for GIFs that decodes them in script —
 * the block structure, the LZW data, the colour tables, transparency,
 * interlacing and disposal — needing nothing of the browser but
 * `ImageData` and `createImageBitmap`. Each frame is held for the
 * duration `durations` reads for it.
 *
 * It decodes lazily and forward, holding the GIF's bytes, its canvas
 * and the frame on show rather than every frame; going back composes
 * again from the nearest frame that does not depend on the ones before
 * it ({@link GifFrameComposer}).
 *
 * Frames are held no larger than `maxLongestSidePx` on their longest
 * side, keeping their shape, each scaled down from the canvas as it is
 * composed. Rejects with an {@link AnimatedImageOpenFailedError} for
 * bytes that are not a GIF, a GIF with no frame, and one whose first
 * frame will not decode.
 */
export class ScriptGifOpener implements AnimatedImageOpener {
  private readonly sizeCap: AnimationFrameSizeCap;

  constructor(
    private readonly files: GifFileReader,
    private readonly durations: AnimationFrameDurationReader,
    private readonly lzw: GifLzwDecoder,
    maxLongestSidePx: number = Infinity,
  ) {
    this.sizeCap = new AnimationFrameSizeCap(maxLongestSidePx);
  }

  async open(blob: Blob): Promise<DrawableFootage> {
    try {
      return await this.openAnimated(blob);
    } catch (error) {
      if (error instanceof AnimatedImageOpenFailedError) throw error;
      throw new AnimatedImageOpenFailedError('A GIF could not be read.', { cause: error });
    }
  }

  private async openAnimated(blob: Blob): Promise<AnimatedImageFootage> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const file = this.files.read(bytes);
    const timing = this.durations.read(bytes);
    if (file === null || timing === null || file.frames.length === 0 || file.width === 0 || file.height === 0) {
      throw new AnimatedImageOpenFailedError('The file is not a GIF with a frame to show.');
    }
    const composer = new GifFrameComposer(file, this.lzw);
    const held = this.sizeCap.fit(composer.width, composer.height);
    const footage = new AnimatedImageFootage(
      new AnimationFrameTimeline(timing.frameDurationsSec.slice(0, composer.frameCount), timing.playCount),
      new ScriptGifAnimationFrameDecoder(composer, held.width, held.height),
    );
    if (await footage.pictureAt(0) !== null) return footage;
    await footage.close();
    throw new AnimatedImageOpenFailedError('The first frame of the GIF did not decode.');
  }
}
