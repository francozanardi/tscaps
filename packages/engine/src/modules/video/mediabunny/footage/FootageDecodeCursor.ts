import type { TimeRange } from '@modules/video/RenderTimeMap';
import type { DecodedVideoFrame, VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

/**
 * Walks one span of a video forward to whatever moment it is asked for,
 * answering the frame on screen at that moment: the last one that starts
 * at or before it. A moment earlier than the last one asked for starts
 * the span over, which is how a pass that repeats comes back to its
 * beginning.
 *
 * Holds at most two of the decoder's frames — the one answered and the
 * one after it, read to know the first has ended — so the decoder is
 * never starved of frames to hand out. The frame answered stays open
 * until the next question or {@link close}.
 */
export class FootageDecodeCursor {
  private iterator: AsyncIterator<DecodedVideoFrame> | null = null;
  private current: DecodedVideoFrame | null = null;
  private pending: DecodedVideoFrame | null = null;
  private exhausted = false;
  private lastAsked: number | null = null;

  constructor(
    private readonly decoder: VideoFrameDecoder,
    private readonly span: TimeRange,
  ) {}

  /** The frame on screen at `sourceSec`, or null when the span holds none at all. */
  async frameAt(sourceSec: number): Promise<DecodedVideoFrame | null> {
    if (this.iterator === null || (this.lastAsked !== null && sourceSec < this.lastAsked)) await this.restart();
    this.lastAsked = sourceSec;
    for (;;) {
      if (this.pending === null) {
        if (this.exhausted) break;
        const next = await this.iterator!.next();
        if (next.done) {
          this.exhausted = true;
          break;
        }
        this.pending = next.value;
      }
      if (this.current !== null && this.pending.timestamp > sourceSec) break;
      this.current?.close();
      this.current = this.pending;
      this.pending = null;
    }
    return this.current;
  }

  async close(): Promise<void> {
    await this.release();
    this.decoder.close();
  }

  private async restart(): Promise<void> {
    await this.release();
    this.iterator = this.decoder.samples(this.span)[Symbol.asyncIterator]();
    this.exhausted = false;
  }

  private async release(): Promise<void> {
    this.current?.close();
    this.pending?.close();
    this.current = null;
    this.pending = null;
    const iterator = this.iterator;
    this.iterator = null;
    await iterator?.return?.();
  }
}
