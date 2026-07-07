import type { PreviewVideoTrack, PreviewScrubSession } from '@core/preview/domain/PreviewVideoTrack';
import type { PreviewVideoFrame } from '@core/preview/domain/PreviewVideoFrame';
import type { DecodeWorkerClient } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerClient';
import { WorkerBitmapPreviewVideoFrame } from '@core/preview/infrastructure/mediabunny/worker/WorkerBitmapPreviewVideoFrame';
import { WorkerMediaBunnyScrubSession } from '@core/preview/infrastructure/mediabunny/worker/WorkerMediaBunnyScrubSession';

/**
 * {@link PreviewVideoTrack} implementation that forwards every
 * decode request across a {@link DecodeWorkerClient}. Heavy work
 * (mediabunny demux, WebCodecs decode, per-frame
 * `createImageBitmap`) runs off the main thread, and the worker
 * transfers each finished bitmap back with a zero-copy
 * postMessage. On the main thread only the pump loop, the paint
 * copy, and the message handler remain — long tasks caused by
 * decode work disappear from the UI thread.
 */
export class WorkerMediaBunnyVideoTrack implements PreviewVideoTrack {

  constructor(private readonly client: DecodeWorkerClient) {}

  async *streamFrames(startSourceSec: number): AsyncIterable<PreviewVideoFrame> {
    for await (const payload of this.client.streamFrames(startSourceSec)) {
      yield new WorkerBitmapPreviewVideoFrame(payload);
    }
  }

  async getFrameAt(sourceSec: number): Promise<PreviewVideoFrame | null> {
    const payload = await this.client.getFrameAt(sourceSec);
    if (!payload) return null;
    return new WorkerBitmapPreviewVideoFrame(payload);
  }

  openScrubSession(): PreviewScrubSession {
    const scrubId = this.client.beginScrubSession();
    return new WorkerMediaBunnyScrubSession(this.client, scrubId);
  }
}
