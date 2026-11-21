import type { AnimationFrame, AnimationFrameDecoder } from '@modules/video/animation/AnimationFrameDecoder';
import { ImageBitmapAnimationFrame } from '@modules/video/animation/ImageBitmapAnimationFrame';
import { VideoFrameAnimationFrame } from '@modules/video/animation/VideoFrameAnimationFrame';

/**
 * {@link AnimationFrameDecoder} over a WebCodecs `ImageDecoder` whose
 * data has been read in full and whose track is known. Each frame is
 * held at `width` × `height`: one decoded larger is scaled down once and
 * the decoded frame released. Closing it closes the decoder.
 */
export class ImageDecoderAnimationFrameDecoder implements AnimationFrameDecoder {
  constructor(
    private readonly decoder: ImageDecoder,
    readonly frameCount: number,
    readonly width: number,
    readonly height: number,
  ) {}

  async decode(frameIndex: number): Promise<AnimationFrame> {
    const { image } = await this.decoder.decode({ frameIndex, completeFramesOnly: true });
    if (image.displayWidth <= this.width && image.displayHeight <= this.height) return new VideoFrameAnimationFrame(image);
    try {
      return new ImageBitmapAnimationFrame(await createImageBitmap(image, {
        resizeWidth: this.width,
        resizeHeight: this.height,
        resizeQuality: 'high',
      }));
    } finally {
      image.close();
    }
  }

  close(): void {
    this.decoder.close();
  }
}
