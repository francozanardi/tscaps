import type { DecodedFramePayload } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerProtocol';

interface ChannelPullResult {
  readonly done: boolean;
  readonly frame: DecodedFramePayload | null;
}

/**
 * Single-producer single-consumer FIFO between the worker's frame
 * messages and a main-thread async iterator. The producer calls
 * {@link pushFrame} when a `-frame` message arrives; the consumer
 * awaits {@link pull} inside its `for await` loop. Frames waiting
 * with no consumer accumulate in an internal queue; a consumer
 * waiting with no frames parks until one arrives or the channel
 * is closed via {@link closeGracefully} or {@link closeWithError}.
 */
export class DecodeWorkerFrameChannel {

  private readonly queuedFrames: DecodedFramePayload[] = [];
  private waitingResolver: ((result: ChannelPullResult) => void) | null = null;
  private closed = false;
  private error: Error | null = null;

  pushFrame(frame: DecodedFramePayload): void {
    if (this.closed) {
      frame.bitmap.close();
      return;
    }
    if (this.waitingResolver) {
      const resolver = this.waitingResolver;
      this.waitingResolver = null;
      resolver({ done: false, frame });
      return;
    }
    this.queuedFrames.push(frame);
  }

  pull(): Promise<ChannelPullResult> {
    if (this.error) return Promise.reject(this.error);
    if (this.queuedFrames.length > 0) {
      return Promise.resolve({ done: false, frame: this.queuedFrames.shift() ?? null });
    }
    if (this.closed) return Promise.resolve({ done: true, frame: null });
    return new Promise((resolve) => {
      this.waitingResolver = resolve;
    });
  }

  closeGracefully(): void {
    if (this.closed) return;
    this.closed = true;
    this.releaseQueuedFrames();
    if (this.waitingResolver) {
      const resolver = this.waitingResolver;
      this.waitingResolver = null;
      resolver({ done: true, frame: null });
    }
  }

  closeWithError(message: string): void {
    if (this.closed) return;
    this.closed = true;
    this.error = new Error(message);
    this.releaseQueuedFrames();
    if (this.waitingResolver) {
      const resolver = this.waitingResolver;
      this.waitingResolver = null;
      resolver({ done: true, frame: null });
    }
  }

  private releaseQueuedFrames(): void {
    for (const frame of this.queuedFrames) frame.bitmap.close();
    this.queuedFrames.length = 0;
  }
}
