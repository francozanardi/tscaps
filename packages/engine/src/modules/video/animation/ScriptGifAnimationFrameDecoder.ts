import type { AnimationFrame, AnimationFrameDecoder } from '@modules/video/animation/AnimationFrameDecoder';
import type { GifFrameComposer } from '@modules/video/animation/GifFrameComposer';
import { ImageBitmapAnimationFrame } from '@modules/video/animation/ImageBitmapAnimationFrame';

/**
 * {@link AnimationFrameDecoder} over a GIF decoded in script, for
 * browsers whose own decoder cannot be asked for one frame at a time.
 * Each frame is composed onto the GIF's canvas and handed out as an
 * `ImageBitmap` of `width` × `height`, scaled down from the canvas where
 * that is smaller. How far back a frame makes it compose again is the
 * composer's: see {@link GifFrameComposer}.
 *
 * Frames are decoded one at a time: a decode is not to start before the
 * one before it settles.
 */
export class ScriptGifAnimationFrameDecoder implements AnimationFrameDecoder {
  private closed = false;

  constructor(
    private readonly composer: GifFrameComposer,
    readonly width: number,
    readonly height: number,
  ) {}

  get frameCount(): number {
    return this.composer.frameCount;
  }

  async decode(frameIndex: number): Promise<AnimationFrame> {
    if (this.closed) throw new Error('A GIF frame was asked of a closed decoder.');
    const pixels = new ImageData(this.composer.compose(frameIndex), this.composer.width, this.composer.height);
    // The next frame is composed into the same array, but only once this
    // bitmap has been made from it: decodes come one at a time.
    const bitmap = this.isScaled()
      ? await createImageBitmap(pixels, { resizeWidth: this.width, resizeHeight: this.height, resizeQuality: 'high' })
      : await createImageBitmap(pixels);
    return new ImageBitmapAnimationFrame(bitmap);
  }

  close(): void {
    this.closed = true;
  }

  private isScaled(): boolean {
    return this.width !== this.composer.width || this.height !== this.composer.height;
  }
}
