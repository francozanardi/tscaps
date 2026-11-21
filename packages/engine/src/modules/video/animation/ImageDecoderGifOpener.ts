import { AnimatedImageFootage } from '@modules/video/animation/AnimatedImageFootage';
import { AnimatedImageOpenFailedError } from '@modules/video/animation/AnimatedImageOpenFailedError';
import type { AnimatedImageOpener } from '@modules/video/animation/AnimatedImageOpener';
import type { AnimationFrameDurationReader } from '@modules/video/animation/AnimationFrameDurationReader';
import { AnimationFrameSizeCap } from '@modules/video/animation/AnimationFrameSizeCap';
import { AnimationFrameTimeline } from '@modules/video/animation/AnimationFrameTimeline';
import type { DrawableFootage } from '@modules/video/animation/DrawableFootage';
import { ImageDecoderAnimationFrameDecoder } from '@modules/video/animation/ImageDecoderAnimationFrameDecoder';

const GIF_TYPE = 'image/gif';

/**
 * {@link AnimatedImageOpener} for GIFs: frames decoded by WebCodecs'
 * `ImageDecoder`, each held for the duration the file states for it.
 *
 * Rejects with an {@link AnimatedImageOpenFailedError} in a browser
 * without `ImageDecoder` or one that will not decode GIFs with it, for
 * a file whose first frame will not decode that way, and where a frame
 * decoded a second time cannot be drawn — which every loop needs, and
 * Firefox's `ImageDecoder` does not give.
 *
 * Frames are held no larger than `maxLongestSidePx` on their longest
 * side, keeping their shape; a larger GIF is scaled down frame by frame
 * as it decodes. The file's bytes are handed over to the decoder rather
 * than copied into it.
 */
export class ImageDecoderGifOpener implements AnimatedImageOpener {
  private readonly sizeCap: AnimationFrameSizeCap;

  constructor(
    private readonly durations: AnimationFrameDurationReader,
    maxLongestSidePx: number = Infinity,
  ) {
    this.sizeCap = new AnimationFrameSizeCap(maxLongestSidePx);
  }

  async open(blob: Blob): Promise<DrawableFootage> {
    if (typeof ImageDecoder === 'undefined' || !(await ImageDecoder.isTypeSupported(GIF_TYPE))) {
      throw new AnimatedImageOpenFailedError('This browser has no ImageDecoder for GIFs.');
    }
    try {
      return await this.openAnimated(blob);
    } catch (error) {
      if (error instanceof AnimatedImageOpenFailedError) throw error;
      throw new AnimatedImageOpenFailedError('ImageDecoder could not read a GIF.', { cause: error });
    }
  }

  private async openAnimated(blob: Blob): Promise<AnimatedImageFootage> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const timing = this.durations.read(bytes);
    if (timing === null || timing.frameDurationsSec.length === 0) {
      throw new AnimatedImageOpenFailedError('The file is not a GIF with a frame to show.');
    }
    const decoder = await this.decoderOf(bytes);
    const footage = new AnimatedImageFootage(
      new AnimationFrameTimeline(timing.frameDurationsSec.slice(0, decoder.frameCount), timing.playCount),
      decoder,
    );
    if (await footage.pictureAt(0) !== null) return footage;
    await footage.close();
    throw new AnimatedImageOpenFailedError('ImageDecoder did not decode the first frame of a GIF.');
  }

  private async decoderOf(bytes: Uint8Array): Promise<ImageDecoderAnimationFrameDecoder> {
    const decoder = new ImageDecoder({ data: bytes, type: GIF_TYPE, transfer: [bytes.buffer as ArrayBuffer] });
    try {
      await decoder.tracks.ready;
      await decoder.completed;
      const track = decoder.tracks.selectedTrack;
      if (!track || track.frameCount === 0) throw new Error('A GIF has no image track with a frame.');
      const { image } = await decoder.decode({ frameIndex: 0 });
      const held = this.sizeCap.fit(image.displayWidth, image.displayHeight);
      image.close();
      if (!(await this.drawsFrameDecodedAgain(decoder))) {
        throw new Error('ImageDecoder hands out a frame decoded a second time that cannot be drawn.');
      }
      return new ImageDecoderAnimationFrameDecoder(decoder, track.frameCount, held.width, held.height);
    } catch (error) {
      decoder.close();
      throw error;
    }
  }

  /**
   * Whether the first frame, decoded again after the frame decoded for
   * it before was released, can still be drawn. Playing a GIF decodes
   * each frame again on every run; where that frame comes back unusable
   * — Firefox hands out a "broken" one — the GIF cannot loop.
   */
  private async drawsFrameDecodedAgain(decoder: ImageDecoder): Promise<boolean> {
    const { image } = await decoder.decode({ frameIndex: 0 });
    try {
      new OffscreenCanvas(1, 1).getContext('2d')?.drawImage(image, 0, 0, 1, 1);
      return true;
    } catch {
      // The draw itself is the question asked: a frame that throws is the answer no.
      return false;
    } finally {
      image.close();
    }
  }
}
