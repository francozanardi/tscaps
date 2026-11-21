import type { VideoSample } from 'mediabunny';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

/**
 * A frame the decoder produced, as it produced it: drawn, timed and
 * closed through the mediabunny {@link VideoSample} it wraps, which it
 * also lends to an encoder that takes frames as decoded.
 */
export class VideoSampleFrame implements DecodedVideoFrame {

  readonly timestamp: number;
  readonly duration: number;

  constructor(readonly sample: VideoSample) {
    this.timestamp = sample.timestamp;
    this.duration = sample.duration;
  }

  draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void {
    this.sample.draw(context, dx, dy, dWidth, dHeight);
  }

  close(): void {
    this.sample.close();
  }
}
