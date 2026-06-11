import type { DecodedVideoFrame, VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

interface VideoElementSetup {
  element: HTMLVideoElement;
  url: string;
}

interface PendingFrame {
  frame: VideoFrame;
  timestamp: number;
}

/**
 * Decoder for inputs whose codec WebCodecs cannot decode but the host's
 * `<video>` element can play (typically HEVC/H.265 in browsers without a
 * WebCodecs HEVC decoder). Plays the file through a hidden video element
 * and captures each painted frame.
 *
 * Two capture paths:
 * - `MediaStreamTrackProcessor` is used when available (Chromium). The
 *   element's `captureStream()` exposes a video track that the processor
 *   converts into a readable stream of `VideoFrame`s.
 * - `requestVideoFrameCallback` is the Safari/Firefox fallback. Frames are
 *   constructed manually from the element and buffered; backpressure is
 *   applied by lowering `playbackRate` once the buffer grows past a
 *   threshold.
 */
export class HtmlVideoElementVideoFrameDecoder implements VideoFrameDecoder {

  private static readonly DEFAULT_FRAME_DURATION_S = 1 / 30;
  private static readonly BUFFER_HIGH_WATERMARK = 60;
  private static readonly SLOW_PLAYBACK_RATE = 0.25;
  private static readonly NORMAL_PLAYBACK_RATE = 1;

  private setup: VideoElementSetup | null = null;
  private closed = false;
  private disposers: Array<() => void> = [];

  private static readonly CODEC_NAMES: Record<string, string> = {
    avc: 'H.264 (AVC)',
    hevc: 'H.265 (HEVC)',
    vp8: 'VP8',
    vp9: 'VP9',
    av1: 'AV1',
  };

  constructor(
    private readonly source: File,
    private readonly inputCodec: string,
  ) {}

  samples(): AsyncIterable<DecodedVideoFrame> {
    console.log('Using HtmlVideoElementVideoFrameDecoder for codec', this.inputCodec);
    return {
      [Symbol.asyncIterator]: () => this.openIterator(),
    };
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const dispose of this.disposers.splice(0)) {
      try { dispose(); } catch { /* best-effort */ }
    }
    if (this.setup) {
      this.teardownElement(this.setup);
      this.setup = null;
    }
  }

  private openIterator(): AsyncIterator<DecodedVideoFrame> {
    const initPromise = this.start();
    let inner: AsyncIterator<DecodedVideoFrame> | null = null;
    return {
      next: async (): Promise<IteratorResult<DecodedVideoFrame>> => {
        if (!inner) inner = await initPromise;
        if (this.closed) return { value: undefined, done: true };
        return inner.next();
      },
      return: async (): Promise<IteratorResult<DecodedVideoFrame>> => {
        this.close();
        return { value: undefined, done: true };
      },
    };
  }

  private async start(): Promise<AsyncIterator<DecodedVideoFrame>> {
    this.setup = await this.createElement();
    if (this.supportsMediaStreamTrackProcessor()) {
      return this.captureViaMediaStreamTrackProcessor(this.setup.element);
    }
    return this.captureViaRequestVideoFrameCallback(this.setup.element);
  }

  private async createElement(): Promise<VideoElementSetup> {
    const url = URL.createObjectURL(this.source);
    const element = document.createElement('video');
    element.src = url;
    element.muted = true;
    element.playsInline = true;
    element.preload = 'auto';
    Object.assign(element.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
    });
    document.body.appendChild(element);
    await new Promise<void>((resolve, reject) => {
      const onLoaded = (): void => { cleanup(); resolve(); };
      const onError = (): void => { cleanup(); reject(this.buildPlaybackError(element.error)); };
      const cleanup = (): void => {
        element.removeEventListener('loadedmetadata', onLoaded);
        element.removeEventListener('error', onError);
      };
      element.addEventListener('loadedmetadata', onLoaded);
      element.addEventListener('error', onError);
    });
    return { element, url };
  }

  private buildPlaybackError(mediaError: MediaError | null): Error {
    const codecName = this.humanCodecName();
    if (mediaError && mediaError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      return new Error(
        `This browser cannot play ${codecName} video. ` +
          `Convert the source to H.264 (the most widely supported codec) and try again.`,
      );
    }
    return new Error(
      `The video could not be opened for playback. ` +
        `Convert the source to H.264 and try again.`,
    );
  }

  private humanCodecName(): string {
    return HtmlVideoElementVideoFrameDecoder.CODEC_NAMES[this.inputCodec] ?? this.inputCodec.toUpperCase();
  }

  private buildUnsupportedDecoderError(): Error {
    return new Error(
      `This browser does not expose a way to capture ${this.humanCodecName()} frames. ` +
        `Convert the source to H.264 and try again.`,
    );
  }

  private supportsMediaStreamTrackProcessor(): boolean {
    return typeof (globalThis as { MediaStreamTrackProcessor?: unknown }).MediaStreamTrackProcessor === 'function';
  }

  private async captureViaMediaStreamTrackProcessor(
    element: HTMLVideoElement,
  ): Promise<AsyncIterator<DecodedVideoFrame>> {
    const capture = (element as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    });
    const captureFn = capture.captureStream ?? capture.mozCaptureStream;
    if (!captureFn) {
      throw this.buildUnsupportedDecoderError();
    }
    const stream = captureFn.call(element);
    const [track] = stream.getVideoTracks();
    if (!track) {
      throw this.buildUnsupportedDecoderError();
    }
    const processor = new (globalThis as unknown as {
      MediaStreamTrackProcessor: new (init: { track: MediaStreamVideoTrack }) => { readable: ReadableStream<VideoFrame> };
    }).MediaStreamTrackProcessor({ track: track as MediaStreamVideoTrack });
    const reader = processor.readable.getReader();
    this.disposers.push(() => { reader.cancel().catch(() => {}); track.stop(); });
    await element.play();
    return this.streamReaderIterator(reader);
  }

  private streamReaderIterator(reader: ReadableStreamDefaultReader<VideoFrame>): AsyncIterator<DecodedVideoFrame> {
    let previous: VideoFrame | null = null;
    let previousTimestamp = 0;
    return {
      next: async (): Promise<IteratorResult<DecodedVideoFrame>> => {
        for (;;) {
          if (this.closed) {
            if (previous) { try { previous.close(); } catch { /* best-effort */ } }
            return { value: undefined, done: true };
          }
          const { value, done } = await reader.read();
          if (done || !value) {
            if (previous) {
              const tail = this.wrap(previous, previousTimestamp, HtmlVideoElementVideoFrameDecoder.DEFAULT_FRAME_DURATION_S);
              previous = null;
              return { value: tail, done: false };
            }
            return { value: undefined, done: true };
          }
          const currentTimestamp = (value.timestamp ?? 0) / 1_000_000;
          if (previous) {
            const duration = Math.max(1 / 240, currentTimestamp - previousTimestamp);
            const out = this.wrap(previous, previousTimestamp, duration);
            previous = value;
            previousTimestamp = currentTimestamp;
            return { value: out, done: false };
          }
          previous = value;
          previousTimestamp = currentTimestamp;
        }
      },
      return: async (): Promise<IteratorResult<DecodedVideoFrame>> => {
        await reader.cancel().catch(() => {});
        if (previous) { try { previous.close(); } catch { /* best-effort */ } }
        return { value: undefined, done: true };
      },
    };
  }

  private async captureViaRequestVideoFrameCallback(
    element: HTMLVideoElement,
  ): Promise<AsyncIterator<DecodedVideoFrame>> {
    if (typeof element.requestVideoFrameCallback !== 'function') {
      throw this.buildUnsupportedDecoderError();
    }
    const pending: PendingFrame[] = [];
    const ready: DecodedVideoFrame[] = [];
    let resumeWaiter: (() => void) | null = null;
    let ended = false;
    let throttled = false;
    let captureError: Error | null = null;
    let lastMediaTime = -Infinity;

    const resume = (): void => {
      if (resumeWaiter) {
        const fn = resumeWaiter;
        resumeWaiter = null;
        fn();
      }
    };

    const onFrame = (_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata): void => {
      if (this.closed) return;
      try {
        const mediaTime = metadata.mediaTime;
        if (mediaTime <= lastMediaTime) {
          if (!element.ended) element.requestVideoFrameCallback(onFrame);
          return;
        }
        lastMediaTime = mediaTime;
        const frame = new VideoFrame(element, { timestamp: Math.round(mediaTime * 1_000_000) });
        pending.push({ frame, timestamp: mediaTime });
      } catch (err) {
        captureError = err instanceof Error ? err : new Error(String(err));
        resume();
        return;
      }
      while (pending.length >= 2) {
        const first = pending[0]!;
        const second = pending[1]!;
        const duration = Math.max(1 / 240, second.timestamp - first.timestamp);
        ready.push(this.wrap(first.frame, first.timestamp, duration));
        pending.shift();
      }
      resume();
      const buffered = ready.length + pending.length;
      if (!throttled && buffered >= HtmlVideoElementVideoFrameDecoder.BUFFER_HIGH_WATERMARK) {
        throttled = true;
        element.playbackRate = HtmlVideoElementVideoFrameDecoder.SLOW_PLAYBACK_RATE;
      }
      if (!element.ended && !this.closed) {
        element.requestVideoFrameCallback(onFrame);
      }
    };

    const onEnded = (): void => {
      ended = true;
      while (pending.length > 0) {
        const next = pending.shift()!;
        const lastDuration = ready.length > 0
          ? ready[ready.length - 1]!.duration
          : HtmlVideoElementVideoFrameDecoder.DEFAULT_FRAME_DURATION_S;
        ready.push(this.wrap(next.frame, next.timestamp, lastDuration));
      }
      resume();
    };

    const onError = (): void => {
      captureError = this.buildPlaybackError(element.error);
      resume();
    };

    element.addEventListener('ended', onEnded);
    element.addEventListener('error', onError);
    this.disposers.push(() => {
      element.removeEventListener('ended', onEnded);
      element.removeEventListener('error', onError);
      for (const p of pending) { try { p.frame.close(); } catch { /* best-effort */ } }
      pending.length = 0;
      for (const f of ready) f.close();
      ready.length = 0;
    });

    element.requestVideoFrameCallback(onFrame);
    await element.play();

    const iterator: AsyncIterator<DecodedVideoFrame> = {
      next: async (): Promise<IteratorResult<DecodedVideoFrame>> => {
        for (;;) {
          if (captureError) throw captureError;
          if (ready.length > 0) {
            const frame = ready.shift()!;
            if (throttled && ready.length + pending.length < HtmlVideoElementVideoFrameDecoder.BUFFER_HIGH_WATERMARK / 2) {
              throttled = false;
              element.playbackRate = HtmlVideoElementVideoFrameDecoder.NORMAL_PLAYBACK_RATE;
            }
            return { value: frame, done: false };
          }
          if (ended) return { value: undefined, done: true };
          if (this.closed) return { value: undefined, done: true };
          await new Promise<void>((resolve) => { resumeWaiter = resolve; });
        }
      },
      return: async (): Promise<IteratorResult<DecodedVideoFrame>> => {
        this.close();
        return { value: undefined, done: true };
      },
    };
    return iterator;
  }

  private wrap(frame: VideoFrame, timestamp: number, duration: number): DecodedVideoFrame {
    return {
      timestamp,
      duration,
      draw: (ctx, dx, dy, dw, dh) => { ctx.drawImage(frame, dx, dy, dw, dh); },
      close: () => { try { frame.close(); } catch { /* best-effort */ } },
    };
  }

  private teardownElement(setup: VideoElementSetup): void {
    try { setup.element.pause(); } catch { /* best-effort */ }
    setup.element.removeAttribute('src');
    try { setup.element.load(); } catch { /* best-effort */ }
    setup.element.remove();
    URL.revokeObjectURL(setup.url);
  }
}
