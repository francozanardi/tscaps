import { VideoSampleSink, type InputVideoTrack, type VideoSample } from 'mediabunny';
import type { DecodedVideoFrame, VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

/**
 * Decodes the input track through WebCodecs by way of mediabunny's
 * {@link VideoSampleSink}. Each yielded frame wraps a {@link VideoSample}
 * and forwards its `draw`/`close` calls verbatim.
 */
export class WebCodecsVideoFrameDecoder implements VideoFrameDecoder {

  private _closed = false;

  constructor(private readonly track: InputVideoTrack) {}

  samples(): AsyncIterable<DecodedVideoFrame> {
    console.log('Using WebCodecsVideoFrameDecoder for track', this.track);
    const iterator = new VideoSampleSink(this.track).samples();
    return {
      [Symbol.asyncIterator]: () => this.adaptIterator(iterator),
    };
  }

  close(): void {
    this._closed = true;
  }

  private adaptIterator(
    source: AsyncGenerator<VideoSample, void, unknown>,
  ): AsyncIterator<DecodedVideoFrame> {
    return {
      next: async (): Promise<IteratorResult<DecodedVideoFrame>> => {
        if (this._closed) return { value: undefined, done: true };
        const { value, done } = await source.next();
        if (done || !value) return { value: undefined, done: true };
        return { value: this.adaptSample(value), done: false };
      },
      return: async (): Promise<IteratorResult<DecodedVideoFrame>> => {
        await source.return?.();
        return { value: undefined, done: true };
      },
    };
  }

  private adaptSample(sample: VideoSample): DecodedVideoFrame {
    return {
      timestamp: sample.timestamp,
      duration: sample.duration,
      draw: (ctx, dx, dy, dw, dh) => sample.draw(ctx, dx, dy, dw, dh),
      close: () => sample.close(),
    };
  }
}
