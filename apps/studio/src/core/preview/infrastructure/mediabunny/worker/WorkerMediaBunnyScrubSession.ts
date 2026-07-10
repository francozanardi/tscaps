import type { PreviewScrubSession } from '@core/preview/domain/PreviewVideoTrack';
import type { PreviewVideoFrame } from '@core/preview/domain/PreviewVideoFrame';
import type { DecodeWorkerClient } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerClient';
import { WorkerBitmapPreviewVideoFrame } from '@core/preview/infrastructure/mediabunny/worker/WorkerBitmapPreviewVideoFrame';

/**
 * {@link PreviewScrubSession} implementation that forwards scrub
 * targets to the decode worker's active scrub session and wraps
 * the streamed bitmaps as domain frames. The underlying worker
 * runs the same coalescing pattern as the main-thread mediabunny
 * scrub session: only the latest target survives while a decode
 * is in flight, so a fast drag never piles up stale timestamps.
 */
export class WorkerMediaBunnyScrubSession implements PreviewScrubSession {

  private closed = false;

  constructor(
    private readonly client: DecodeWorkerClient,
    private readonly scrubId: number,
  ) {}

  scrubTo(sourceSec: number): void {
    if (this.closed) return;
    this.client.pushScrubTarget(this.scrubId, sourceSec);
  }

  async *frames(): AsyncIterable<PreviewVideoFrame> {
    for await (const payload of this.client.scrubFrames(this.scrubId)) {
      yield new WorkerBitmapPreviewVideoFrame(payload);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.client.closeScrubSession(this.scrubId);
  }
}
