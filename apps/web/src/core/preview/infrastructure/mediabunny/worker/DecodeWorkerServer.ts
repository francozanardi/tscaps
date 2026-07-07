import {
  ALL_FORMATS,
  BlobSource,
  CanvasSink,
  Input,
  VideoSampleSink,
  type VideoSample,
  type WrappedCanvas,
} from 'mediabunny';
import type {
  ClientToWorkerMessage,
  DecodedFramePayload,
  WorkerToClientMessage,
} from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerProtocol';

interface DecodeWorkerResponder {
  respond(message: WorkerToClientMessage, transferables?: Transferable[]): void;
}

interface StreamState {
  readonly streamId: number;
  readonly abortController: AbortController;
  pendingCredits: number;
  wakeUpCreditWait: () => void;
  sampleIterator: AsyncGenerator<VideoSample, void, unknown> | null;
}

interface ScrubState {
  readonly scrubId: number;
  readonly abortController: AbortController;
  pendingSourceSec: number | null;
  pendingCredits: number;
  wakeUpCreditWait: () => void;
  wakeUpTargetWait: () => void;
}

/**
 * Runs inside the decode worker. Owns the mediabunny {@link Input}
 * and sinks for the currently opened source and dispatches one
 * message at a time.
 *
 * Streaming decodes through a {@link VideoSampleSink} driven by
 * hand, not through `CanvasSink.canvases()`: the sample iterator's
 * `return()` takes effect while a `next()` is pending, so aborting
 * a stream (every playing seek) stops the in-flight GOP decode
 * within one packet. Scrubbing and one-shot frames keep using the
 * {@link CanvasSink}, whose per-session decoder lifecycle already
 * matches their usage.
 *
 * Every operation that produces frames (streaming, scrubbing,
 * one-shot) uses credit-based flow control: the client keeps one
 * credit outstanding at a time and posts `-request-next` after
 * consuming each frame. That keeps the postMessage queue and the
 * mediabunny decode queue bounded even when the main thread lags.
 *
 * Only one streaming and one scrubbing operation are supported at
 * a time; a concurrent request replaces the previous one. Runs of
 * the same kind are serialised internally so two decode loops
 * never run against the source at once, and every abort posts the
 * session's closing message (`stream-end` / `scrub-closed`) — a
 * silently dropped session would leave its consumer parked
 * forever on an in-flight pull.
 */
export class DecodeWorkerServer {

  private input: Input | null = null;
  private sink: CanvasSink | null = null;
  private sampleSink: VideoSampleSink | null = null;
  private streamCanvas: OffscreenCanvas | null = null;
  private activeStream: StreamState | null = null;
  private activeScrub: ScrubState | null = null;
  private lastStreamRun: Promise<void> = Promise.resolve();
  private lastScrubRun: Promise<void> = Promise.resolve();

  constructor(private readonly responder: DecodeWorkerResponder) {}

  handle(message: ClientToWorkerMessage): void {
    switch (message.type) {
      case 'open':
        void this.handleOpen(message.blob, message.targetWidthPx, message.targetHeightPx);
        return;
      case 'stream-start':
        this.handleStreamStart(message.streamId, message.startSourceSec);
        return;
      case 'stream-request-next':
        this.creditActiveStream(message.streamId);
        return;
      case 'stream-stop':
        this.stopActiveStream(message.streamId);
        return;
      case 'frame-at':
        void this.handleFrameAt(message.requestId, message.sourceSec);
        return;
      case 'scrub-start':
        this.handleScrubStart(message.scrubId);
        return;
      case 'scrub-to':
        this.pushScrubTarget(message.scrubId, message.sourceSec);
        return;
      case 'scrub-request-next':
        this.creditActiveScrub(message.scrubId);
        return;
      case 'scrub-close':
        this.closeActiveScrub(message.scrubId);
        return;
    }
  }

  private async handleOpen(blob: Blob, targetWidthPx: number, targetHeightPx: number): Promise<void> {
    this.disposeCurrentInput();
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    try {
      const videoTrack = await input.getPrimaryVideoTrack();
      if (!videoTrack) throw new Error('The selected file has no video track.');
      const canDecode = await videoTrack.canDecode();
      if (!canDecode) {
        const codec = (await videoTrack.getCodec()) ?? 'unknown';
        throw new Error(
          `This browser cannot decode the video codec "${codec}". Convert the source to H.264 and try again.`,
        );
      }
      const [widthPx, heightPx, durationSec, codec] = await Promise.all([
        videoTrack.getDisplayWidth(),
        videoTrack.getDisplayHeight(),
        videoTrack.computeDuration(),
        videoTrack.getCodec(),
      ]);
      this.input = input;
      this.sink = new CanvasSink(videoTrack, {
        width: targetWidthPx,
        height: targetHeightPx,
        fit: 'contain',
        poolSize: 2,
      });
      this.sampleSink = new VideoSampleSink(videoTrack);
      this.streamCanvas = new OffscreenCanvas(targetWidthPx, targetHeightPx);
      this.responder.respond({
        type: 'opened',
        widthPx,
        heightPx,
        durationSec,
        videoCodec: codec ?? 'unknown',
      });
    } catch (err) {
      input.dispose();
      this.responder.respond({ type: 'open-failed', message: this.describeError(err) });
    }
  }

  private handleStreamStart(streamId: number, startSourceSec: number): void {
    const sampleSink = this.sampleSink;
    if (!sampleSink) {
      this.responder.respond({ type: 'stream-error', streamId, message: 'Source not opened.' });
      return;
    }
    this.abortActiveStream();
    const state: StreamState = {
      streamId,
      abortController: new AbortController(),
      pendingCredits: 1,
      wakeUpCreditWait: () => {},
      sampleIterator: null,
    };
    this.activeStream = state;
    const previousRun = this.lastStreamRun;
    this.lastStreamRun = this.runStreamWhenPreviousDrained(previousRun, sampleSink, state, startSourceSec);
  }

  private async runStreamWhenPreviousDrained(
    previousRun: Promise<void>,
    sampleSink: VideoSampleSink,
    state: StreamState,
    startSourceSec: number,
  ): Promise<void> {
    await previousRun;
    if (state.abortController.signal.aborted) return;
    const iterator = sampleSink.samples(startSourceSec);
    state.sampleIterator = iterator;
    try {
      while (true) {
        const result = await iterator.next();
        if (result.done) {
          if (!state.abortController.signal.aborted) {
            this.responder.respond({ type: 'stream-end', streamId: state.streamId });
          }
          return;
        }
        const sample = result.value;
        if (state.abortController.signal.aborted) { sample.close(); return; }
        await this.awaitStreamCredit(state);
        if (state.abortController.signal.aborted) { sample.close(); return; }
        await this.emitStreamSample(state.streamId, sample);
      }
    } catch (err) {
      if (!state.abortController.signal.aborted) {
        this.responder.respond({ type: 'stream-error', streamId: state.streamId, message: this.describeError(err) });
      }
    } finally {
      this.finishStreamIterator(state);
      if (this.activeStream === state) this.activeStream = null;
    }
  }

  /**
   * Terminates the run's sample iterator, if it still owns one.
   * mediabunny's sample iterator is hand-rolled, so `return()`
   * takes effect immediately even while a `next()` is pending —
   * the internal decode pump stops within one packet and the
   * decoder is closed. A native async generator's `return()`
   * would queue behind the pending `next()` and let a seek's
   * whole GOP decode run to completion first.
   */
  private finishStreamIterator(state: StreamState): void {
    const iterator = state.sampleIterator;
    state.sampleIterator = null;
    if (!iterator) return;
    void iterator.return().catch(() => { /* already terminated */ });
  }

  private awaitStreamCredit(state: StreamState): Promise<void> {
    if (state.pendingCredits > 0) {
      state.pendingCredits--;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      state.wakeUpCreditWait = () => {
        state.pendingCredits--;
        resolve();
      };
    });
  }

  private async emitStreamSample(streamId: number, sample: VideoSample): Promise<void> {
    const frame = await this.sampleToDecodedFrame(sample);
    this.responder.respond(
      { type: 'stream-frame', streamId, frame },
      [frame.bitmap],
    );
  }

  /**
   * Draws the sample onto the reusable stream canvas with contain
   * fitting (rotation metadata applied by the sample itself) and
   * snapshots the result as a standalone {@link ImageBitmap}.
   * Closes the sample; the returned bitmap is the caller's to
   * transfer or release.
   */
  private async sampleToDecodedFrame(sample: VideoSample): Promise<DecodedFramePayload> {
    const canvas = this.streamCanvas;
    if (!canvas) {
      sample.close();
      throw new Error('Source not opened.');
    }
    const context = canvas.getContext('2d');
    if (!context) {
      sample.close();
      throw new Error('The stream canvas has no 2D context.');
    }
    const timestampSec = sample.timestamp;
    const scale = Math.min(canvas.width / sample.displayWidth, canvas.height / sample.displayHeight);
    const drawWidthPx = Math.round(sample.displayWidth * scale);
    const drawHeightPx = Math.round(sample.displayHeight * scale);
    const drawX = Math.floor((canvas.width - drawWidthPx) / 2);
    const drawY = Math.floor((canvas.height - drawHeightPx) / 2);
    context.clearRect(0, 0, canvas.width, canvas.height);
    try {
      sample.draw(context, drawX, drawY, drawWidthPx, drawHeightPx);
    } finally {
      sample.close();
    }
    const bitmap = await createImageBitmap(canvas);
    return {
      bitmap,
      timestampSec,
      widthPx: canvas.width,
      heightPx: canvas.height,
    };
  }

  private creditActiveStream(streamId: number): void {
    const state = this.activeStream;
    if (!state || state.streamId !== streamId) return;
    state.pendingCredits++;
    const wake = state.wakeUpCreditWait;
    state.wakeUpCreditWait = () => {};
    wake();
  }

  private stopActiveStream(streamId: number): void {
    if (this.activeStream?.streamId !== streamId) return;
    this.abortActiveStream();
  }

  private abortActiveStream(): void {
    const state = this.activeStream;
    if (!state) return;
    state.abortController.abort();
    // Stops the in-flight GOP decode within one packet instead of letting it run to its first yield.
    this.finishStreamIterator(state);
    const wake = state.wakeUpCreditWait;
    state.wakeUpCreditWait = () => {};
    wake();
    this.activeStream = null;
    // Without this notification the consumer of the aborted stream would park forever on its in-flight pull.
    this.responder.respond({ type: 'stream-end', streamId: state.streamId });
  }

  private async handleFrameAt(requestId: number, sourceSec: number): Promise<void> {
    const sink = this.sink;
    if (!sink) {
      this.responder.respond({ type: 'frame-error', requestId, message: 'Source not opened.' });
      return;
    }
    try {
      const wrapped = await sink.getCanvas(sourceSec);
      if (!wrapped) {
        const first = await this.firstCanvasStartingAt(sink, sourceSec);
        if (!first) {
          this.responder.respond({ type: 'frame-response', requestId, frame: null });
          return;
        }
        const frame = await this.wrappedToDecodedFrame(first);
        this.responder.respond({ type: 'frame-response', requestId, frame }, [frame.bitmap]);
        return;
      }
      const frame = await this.wrappedToDecodedFrame(wrapped);
      this.responder.respond({ type: 'frame-response', requestId, frame }, [frame.bitmap]);
    } catch (err) {
      this.responder.respond({ type: 'frame-error', requestId, message: this.describeError(err) });
    }
  }

  private async firstCanvasStartingAt(sink: CanvasSink, sourceSec: number): Promise<WrappedCanvas | null> {
    for await (const wrapped of sink.canvases(sourceSec)) {
      return wrapped;
    }
    return null;
  }

  private handleScrubStart(scrubId: number): void {
    const sink = this.sink;
    if (!sink) {
      this.responder.respond({ type: 'scrub-closed', scrubId });
      return;
    }
    this.abortActiveScrub();
    const state: ScrubState = {
      scrubId,
      abortController: new AbortController(),
      pendingSourceSec: null,
      pendingCredits: 1,
      wakeUpCreditWait: () => {},
      wakeUpTargetWait: () => {},
    };
    this.activeScrub = state;
    const previousRun = this.lastScrubRun;
    this.lastScrubRun = this.runScrubWhenPreviousDrained(previousRun, sink, state);
  }

  private async runScrubWhenPreviousDrained(
    previousRun: Promise<void>,
    sink: CanvasSink,
    state: ScrubState,
  ): Promise<void> {
    await previousRun;
    if (state.abortController.signal.aborted) return;
    try {
      for await (const wrapped of sink.canvasesAtTimestamps(this.streamScrubTargets(state))) {
        if (state.abortController.signal.aborted) break;
        if (!wrapped) continue;
        await this.awaitScrubCredit(state);
        if (state.abortController.signal.aborted) break;
        await this.emitScrubFrame(state.scrubId, wrapped);
      }
      if (!state.abortController.signal.aborted) {
        this.responder.respond({ type: 'scrub-closed', scrubId: state.scrubId });
      }
    } catch {
      // mediabunny throws when the sink is disposed mid-scrub; the session is being torn down anyway.
      if (!state.abortController.signal.aborted) {
        this.responder.respond({ type: 'scrub-closed', scrubId: state.scrubId });
      }
    } finally {
      if (this.activeScrub === state) this.activeScrub = null;
    }
  }

  private async *streamScrubTargets(state: ScrubState): AsyncGenerator<number> {
    while (!state.abortController.signal.aborted) {
      if (state.pendingSourceSec === null) {
        await this.awaitScrubTarget(state);
        if (state.abortController.signal.aborted) return;
      }
      const target = state.pendingSourceSec!;
      state.pendingSourceSec = null;
      yield target;
    }
  }

  private awaitScrubTarget(state: ScrubState): Promise<void> {
    return new Promise((resolve) => {
      state.wakeUpTargetWait = () => resolve();
    });
  }

  private awaitScrubCredit(state: ScrubState): Promise<void> {
    if (state.pendingCredits > 0) {
      state.pendingCredits--;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      state.wakeUpCreditWait = () => {
        state.pendingCredits--;
        resolve();
      };
    });
  }

  private async emitScrubFrame(scrubId: number, wrapped: WrappedCanvas): Promise<void> {
    const frame = await this.wrappedToDecodedFrame(wrapped);
    this.responder.respond({ type: 'scrub-frame', scrubId, frame }, [frame.bitmap]);
  }

  private pushScrubTarget(scrubId: number, sourceSec: number): void {
    const state = this.activeScrub;
    if (!state || state.scrubId !== scrubId) return;
    state.pendingSourceSec = sourceSec;
    const wake = state.wakeUpTargetWait;
    state.wakeUpTargetWait = () => {};
    wake();
  }

  private creditActiveScrub(scrubId: number): void {
    const state = this.activeScrub;
    if (!state || state.scrubId !== scrubId) return;
    state.pendingCredits++;
    const wake = state.wakeUpCreditWait;
    state.wakeUpCreditWait = () => {};
    wake();
  }

  private closeActiveScrub(scrubId: number): void {
    if (this.activeScrub?.scrubId !== scrubId) return;
    this.abortActiveScrub();
  }

  private abortActiveScrub(): void {
    const state = this.activeScrub;
    if (!state) return;
    state.abortController.abort();
    const wakeTarget = state.wakeUpTargetWait;
    state.wakeUpTargetWait = () => {};
    wakeTarget();
    const wakeCredit = state.wakeUpCreditWait;
    state.wakeUpCreditWait = () => {};
    wakeCredit();
    this.activeScrub = null;
    // Without this notification the consumer of the aborted scrub would park forever on its in-flight pull.
    this.responder.respond({ type: 'scrub-closed', scrubId: state.scrubId });
  }

  private async wrappedToDecodedFrame(wrapped: WrappedCanvas): Promise<DecodedFramePayload> {
    const bitmap = await createImageBitmap(wrapped.canvas);
    return {
      bitmap,
      timestampSec: wrapped.timestamp,
      widthPx: wrapped.canvas.width,
      heightPx: wrapped.canvas.height,
    };
  }

  private disposeCurrentInput(): void {
    this.abortActiveStream();
    this.abortActiveScrub();
    if (this.input && !this.input.disposed) this.input.dispose();
    this.input = null;
    this.sink = null;
    this.sampleSink = null;
    this.streamCanvas = null;
  }

  private describeError(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
