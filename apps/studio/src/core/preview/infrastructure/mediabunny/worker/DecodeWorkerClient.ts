import type {
  ClientToWorkerMessage,
  DecodedFramePayload,
  WorkerToClientMessage,
} from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerProtocol';
import { DecodeWorkerFrameChannel } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerFrameChannel';

export interface DecodeWorkerOpenResult {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly durationSec: number;
  readonly videoCodec: string;
}

interface PendingOpen {
  resolve(result: DecodeWorkerOpenResult): void;
  reject(err: Error): void;
}

interface PendingFrameAt {
  resolve(frame: DecodedFramePayload | null): void;
  reject(err: Error): void;
}

/**
 * Main-thread proxy for the video decode worker. Owns the
 * {@link Worker} instance and translates method calls into
 * postMessage traffic, matching each worker reply back to the
 * originating request via monotonic IDs. Consumers see a plain
 * async API and never touch messages directly.
 *
 * One opened source per client. Streaming, scrubbing and one-shot
 * frame requests share the underlying worker and mediabunny sink;
 * the worker enforces that only one stream and one scrub run
 * concurrently — callers are expected to serialise their own
 * lifecycle to match.
 */
export class DecodeWorkerClient {

  private readonly worker: Worker;
  private nextId = 1;
  private openPending: PendingOpen | null = null;
  private readonly streamChannels = new Map<number, DecodeWorkerFrameChannel>();
  private readonly scrubChannels = new Map<number, DecodeWorkerFrameChannel>();
  private readonly frameAtPending = new Map<number, PendingFrameAt>();
  private disposed = false;

  constructor() {
    this.worker = new Worker(
      new URL('./decodeWorker.ts', import.meta.url),
      { type: 'module' },
    );
    this.worker.onmessage = (event: MessageEvent<WorkerToClientMessage>): void => {
      this.handleWorkerMessage(event.data);
    };
    this.worker.onerror = (event: ErrorEvent): void => {
      console.error(`[DecodeWorker] worker crashed: ${event.message || 'unknown error'}`);
      this.failEverythingInFlight(event.message || 'Decode worker crashed.');
    };
    this.worker.onmessageerror = (): void => {
      console.error('[DecodeWorker] a worker message failed to deserialize');
    };
  }

  open(blob: Blob, targetWidthPx: number, targetHeightPx: number): Promise<DecodeWorkerOpenResult> {
    if (this.disposed) return Promise.reject(new Error('Decode worker client already disposed.'));
    if (this.openPending) return Promise.reject(new Error('Decode worker already opening a source.'));
    return new Promise((resolve, reject) => {
      this.openPending = { resolve, reject };
      this.postMessage({ type: 'open', blob, targetWidthPx, targetHeightPx });
    });
  }

  streamFrames(startSourceSec: number): AsyncIterable<DecodedFramePayload> {
    const streamId = this.nextId++;
    const channel = new DecodeWorkerFrameChannel();
    this.streamChannels.set(streamId, channel);
    this.postMessage({ type: 'stream-start', streamId, startSourceSec });
    return this.pullFramesUntilChannelCloses(channel, {
      requestNext: () => this.postMessage({ type: 'stream-request-next', streamId }),
      stop: () => this.postMessage({ type: 'stream-stop', streamId }),
      onFinally: () => this.streamChannels.delete(streamId),
    });
  }

  getFrameAt(sourceSec: number): Promise<DecodedFramePayload | null> {
    const requestId = this.nextId++;
    return new Promise((resolve, reject) => {
      this.frameAtPending.set(requestId, { resolve, reject });
      this.postMessage({ type: 'frame-at', requestId, sourceSec });
    });
  }

  beginScrubSession(): number {
    const scrubId = this.nextId++;
    const channel = new DecodeWorkerFrameChannel();
    this.scrubChannels.set(scrubId, channel);
    this.postMessage({ type: 'scrub-start', scrubId });
    return scrubId;
  }

  pushScrubTarget(scrubId: number, sourceSec: number): void {
    this.postMessage({ type: 'scrub-to', scrubId, sourceSec });
  }

  scrubFrames(scrubId: number): AsyncIterable<DecodedFramePayload> {
    const channel = this.scrubChannels.get(scrubId);
    if (!channel) throw new Error(`Scrub session ${scrubId} not open.`);
    return this.pullFramesUntilChannelCloses(channel, {
      requestNext: () => this.postMessage({ type: 'scrub-request-next', scrubId }),
      stop: () => {},
      onFinally: () => this.scrubChannels.delete(scrubId),
    });
  }

  closeScrubSession(scrubId: number): void {
    this.postMessage({ type: 'scrub-close', scrubId });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.failEverythingInFlight('Decode worker client disposed.');
    this.worker.terminate();
  }

  private async *pullFramesUntilChannelCloses(
    channel: DecodeWorkerFrameChannel,
    hooks: {
      readonly requestNext: () => void;
      readonly stop: () => void;
      readonly onFinally: () => void;
    },
  ): AsyncGenerator<DecodedFramePayload> {
    try {
      while (true) {
        const next = await channel.pull();
        if (next.done || !next.frame) return;
        yield next.frame;
        hooks.requestNext();
      }
    } finally {
      // Frames still queued when the consumer leaves hold live ImageBitmaps; closing releases them.
      channel.closeGracefully();
      hooks.stop();
      hooks.onFinally();
    }
  }

  private postMessage(message: ClientToWorkerMessage): void {
    this.worker.postMessage(message);
  }

  private handleWorkerMessage(message: WorkerToClientMessage): void {
    switch (message.type) {
      case 'opened':
        this.resolveOpen(message);
        return;
      case 'open-failed':
        this.rejectOpen(message.message);
        return;
      case 'stream-frame':
        this.deliverFrameOrRelease(this.streamChannels.get(message.streamId), message.frame);
        return;
      case 'stream-end':
        this.streamChannels.get(message.streamId)?.closeGracefully();
        return;
      case 'stream-error':
        this.streamChannels.get(message.streamId)?.closeWithError(message.message);
        return;
      case 'frame-response':
        this.frameAtPending.get(message.requestId)?.resolve(message.frame);
        this.frameAtPending.delete(message.requestId);
        return;
      case 'frame-error':
        this.frameAtPending.get(message.requestId)?.reject(new Error(message.message));
        this.frameAtPending.delete(message.requestId);
        return;
      case 'scrub-frame':
        this.deliverFrameOrRelease(this.scrubChannels.get(message.scrubId), message.frame);
        return;
      case 'scrub-closed':
        this.scrubChannels.get(message.scrubId)?.closeGracefully();
        return;
    }
  }

  private deliverFrameOrRelease(
    channel: DecodeWorkerFrameChannel | undefined,
    frame: DecodedFramePayload,
  ): void {
    if (channel) {
      channel.pushFrame(frame);
      return;
    }
    // The session was torn down while this frame was in flight; without an owner the bitmap must be released here.
    frame.bitmap.close();
  }

  private resolveOpen(result: DecodeWorkerOpenResult): void {
    const pending = this.openPending;
    this.openPending = null;
    pending?.resolve(result);
  }

  private rejectOpen(message: string): void {
    const pending = this.openPending;
    this.openPending = null;
    pending?.reject(new Error(message));
  }

  private failEverythingInFlight(message: string): void {
    const err = new Error(message);
    this.openPending?.reject(err);
    this.openPending = null;
    for (const channel of this.streamChannels.values()) channel.closeWithError(message);
    this.streamChannels.clear();
    for (const channel of this.scrubChannels.values()) channel.closeWithError(message);
    this.scrubChannels.clear();
    for (const pending of this.frameAtPending.values()) pending.reject(err);
    this.frameAtPending.clear();
  }
}
