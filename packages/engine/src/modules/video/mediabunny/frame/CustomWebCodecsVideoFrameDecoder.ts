import { EncodedPacketSink, type InputVideoTrack } from 'mediabunny';
import type { DecodedVideoFrame, VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

/**
 * How many decode operations may be in flight at the WebCodecs level.
 * The pump throttles itself against `VideoDecoder.decodeQueueSize` to
 * keep the decoder constantly fed without buffering the whole track.
 */
const MAX_DECODE_QUEUE = 16;

interface PullerEntry {
  resolve: (result: IteratorResult<DecodedVideoFrame>) => void;
  reject: (err: Error) => void;
}

/**
 * Drives a WebCodecs {@link VideoDecoder} directly off mediabunny's
 * {@link EncodedPacketSink}. Going through `VideoSampleSink` introduces
 * a per-frame serialization that dominates render time on Firefox
 * (where WebCodecs has noticeably higher per-call latency than
 * Chromium); feeding the decoder ourselves lets the pipeline stay
 * saturated while frames are reordered internally for presentation.
 *
 * Packets are fed in decode order; frames are yielded in presentation
 * order — the WebCodecs `VideoDecoder` handles B-frame reordering on
 * the output side.
 */
export class CustomWebCodecsVideoFrameDecoder implements VideoFrameDecoder {

  private closed = false;
  private decoder: VideoDecoder | null = null;

  constructor(private readonly track: InputVideoTrack) {}

  samples(): AsyncIterable<DecodedVideoFrame> {
    return {
      [Symbol.asyncIterator]: () => this.iterate(),
    };
  }

  close(): void {
    this.closed = true;
    const decoder = this.decoder;
    if (decoder && decoder.state !== 'closed') {
      try { decoder.close(); } catch { /* already closed */ }
    }
  }

  private iterate(): AsyncIterator<DecodedVideoFrame> {
    const ready: VideoFrame[] = [];
    const pullers: PullerEntry[] = [];
    let pumpError: Error | null = null;
    let pumpDone = false;

    const drainPullers = (): void => {
      while (pullers.length > 0) {
        if (ready.length > 0) {
          pullers.shift()!.resolve({ value: this.wrap(ready.shift()!), done: false });
        } else if (pumpError) {
          pullers.shift()!.reject(pumpError);
        } else if (pumpDone) {
          pullers.shift()!.resolve({ value: undefined, done: true });
        } else {
          break;
        }
      }
    };

    const decoder = new VideoDecoder({
      output: (frame) => {
        if (pullers.length > 0) {
          pullers.shift()!.resolve({ value: this.wrap(frame), done: false });
        } else {
          ready.push(frame);
        }
      },
      error: (err) => {
        pumpError = err instanceof Error ? err : new Error(String(err));
        drainPullers();
      },
    });
    this.decoder = decoder;

    const pump = (async (): Promise<void> => {
      try {
        const config = await this.track.getDecoderConfig();
        if (!config) throw new Error('Input video track has no decoder configuration');
        decoder.configure(config);
        const sink = new EncodedPacketSink(this.track);
        for await (const packet of sink.packets()) {
          if (this.closed) break;
          while (decoder.decodeQueueSize > MAX_DECODE_QUEUE && !this.closed) {
            await this.waitForDequeue(decoder);
          }
          if (this.closed) break;
          decoder.decode(packet.toEncodedVideoChunk());
        }
        if (!this.closed) await decoder.flush();
      } catch (err) {
        pumpError = err instanceof Error ? err : new Error(String(err));
      } finally {
        pumpDone = true;
        drainPullers();
      }
    })();

    return {
      next: async (): Promise<IteratorResult<DecodedVideoFrame>> => {
        if (ready.length > 0) {
          return { value: this.wrap(ready.shift()!), done: false };
        }
        if (pumpError) throw pumpError;
        if (pumpDone) return { value: undefined, done: true };
        return new Promise<IteratorResult<DecodedVideoFrame>>((resolve, reject) => {
          pullers.push({ resolve, reject });
        });
      },
      return: async (): Promise<IteratorResult<DecodedVideoFrame>> => {
        this.closed = true;
        for (const frame of ready) frame.close();
        ready.length = 0;
        await pump.catch(() => undefined);
        return { value: undefined, done: true };
      },
    };
  }

  private waitForDequeue(decoder: VideoDecoder): Promise<void> {
    return new Promise<void>((resolve) => {
      const handler = (): void => {
        decoder.removeEventListener('dequeue', handler);
        resolve();
      };
      decoder.addEventListener('dequeue', handler);
    });
  }

  private wrap(frame: VideoFrame): DecodedVideoFrame {
    return {
      timestamp: frame.timestamp / 1e6,
      duration: (frame.duration ?? 0) / 1e6,
      draw: (ctx, dx, dy, dw, dh) => ctx.drawImage(frame, dx, dy, dw, dh),
      close: () => frame.close(),
    };
  }
}
