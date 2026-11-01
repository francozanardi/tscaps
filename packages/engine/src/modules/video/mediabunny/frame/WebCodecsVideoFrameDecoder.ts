import { VideoSampleSink, type InputVideoTrack, type VideoSample } from 'mediabunny';
import type { TimeRange } from '@modules/video/RenderTimeMap';
import type { DecodedVideoFrame, VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { VideoFrameDecodeFailedError } from '@modules/video/mediabunny/frame/VideoFrameDecodeFailedError';

/**
 * Decodes the input track through WebCodecs by way of mediabunny's
 * {@link VideoSampleSink}. Each yielded frame wraps a {@link VideoSample}
 * and forwards its `draw`/`close` calls verbatim.
 *
 * A frame the browser cannot decode partway through a read rejects that
 * iteration with {@link VideoFrameDecodeFailedError}, naming how far the
 * read got.
 */
export class WebCodecsVideoFrameDecoder implements VideoFrameDecoder {

  private _closed = false;

  constructor(private readonly track: InputVideoTrack) {}

  samples(span?: TimeRange): AsyncIterable<DecodedVideoFrame> {
    const iterator = new VideoSampleSink(this.track).samples(
      span?.startSec,
      span && Number.isFinite(span.endSec) ? span.endSec : undefined,
    );
    return {
      [Symbol.asyncIterator]: () => this.adaptIterator(iterator, span?.startSec ?? 0),
    };
  }

  canSeek(): boolean {
    return true;
  }

  close(): void {
    this._closed = true;
  }

  private adaptIterator(
    source: AsyncGenerator<VideoSample, void, unknown>,
    startSec: number,
  ): AsyncIterator<DecodedVideoFrame> {
    let decodedUntilSec = startSec;
    return {
      next: async (): Promise<IteratorResult<DecodedVideoFrame>> => {
        if (this._closed) return { value: undefined, done: true };
        const { value, done } = await this.nextSample(source, decodedUntilSec);
        if (done || !value) return { value: undefined, done: true };
        decodedUntilSec = value.timestamp + value.duration;
        return { value: this.adaptSample(value), done: false };
      },
      return: async (): Promise<IteratorResult<DecodedVideoFrame>> => {
        await source.return?.();
        return { value: undefined, done: true };
      },
    };
  }

  private async nextSample(
    source: AsyncGenerator<VideoSample, void, unknown>,
    decodedUntilSec: number,
  ): Promise<IteratorResult<VideoSample, void>> {
    try {
      return await source.next();
    } catch (cause) {
      throw new VideoFrameDecodeFailedError(decodedUntilSec, { cause });
    }
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
