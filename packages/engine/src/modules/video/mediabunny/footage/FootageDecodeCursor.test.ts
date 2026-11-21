import { describe, expect, it } from 'vitest';
import type { TimeRange } from '@modules/video/RenderTimeMap';
import { FootageDecodeCursor } from '@modules/video/mediabunny/footage/FootageDecodeCursor';
import type { DecodedVideoFrame, VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

/**
 * The frame answered is the one on screen at the moment asked: frames
 * are skipped when the output outruns the video and repeated when the
 * video is the slower one. Going back to an earlier moment reads the
 * span again from its start. The decoder never has more than two of its
 * frames out, and every one it lent is handed back.
 */

class CountingDecoder implements VideoFrameDecoder {
  open = 0;
  maxOpen = 0;
  closed = 0;
  reads = 0;

  constructor(private readonly timestamps: readonly number[]) {}

  samples(span?: TimeRange): AsyncIterable<DecodedVideoFrame> {
    this.reads++;
    const start = span?.startSec ?? 0;
    const end = span?.endSec ?? Infinity;
    const inSpan = this.timestamps.filter((timestamp) => timestamp >= start && timestamp < end);
    return {
      [Symbol.asyncIterator]: () => {
        let index = 0;
        return {
          next: () => Promise.resolve(index < inSpan.length
            ? { value: this.lend(inSpan[index++]!), done: false }
            : { value: undefined, done: true }),
          return: () => Promise.resolve({ value: undefined, done: true }),
        };
      },
    };
  }

  canSeek(): boolean {
    return true;
  }

  close(): void {}

  private lend(timestamp: number): DecodedVideoFrame {
    this.open++;
    this.maxOpen = Math.max(this.maxOpen, this.open);
    let closed = false;
    return {
      timestamp,
      duration: 0,
      draw: () => {},
      close: () => {
        if (closed) return;
        closed = true;
        this.open--;
        this.closed++;
      },
    };
  }
}

/** A video at 10 frames a second. */
const TEN_FPS = Array.from({ length: 20 }, (_, index) => index / 10);

describe('FootageDecodeCursor', () => {
  it('answers the frame on screen at each moment, skipping and repeating as the rates differ', async () => {
    const cursor = new FootageDecodeCursor(new CountingDecoder(TEN_FPS), { startSec: 0, endSec: Infinity });

    const seen = [];
    for (const moment of [0, 0.05, 0.12, 0.35, 0.36]) seen.push((await cursor.frameAt(moment))?.timestamp);

    expect(seen).toEqual([0, 0, 0.1, 0.3, 0.3]);
  });

  it('reads the span again from its start when asked for an earlier moment', async () => {
    const decoder = new CountingDecoder(TEN_FPS);
    const cursor = new FootageDecodeCursor(decoder, { startSec: 0.5, endSec: 1 });

    await cursor.frameAt(0.9);
    const again = await cursor.frameAt(0.5);

    expect(again?.timestamp).toBe(0.5);
    expect(decoder.reads).toBe(2);
  });

  it('holds the last frame once the span runs out', async () => {
    const cursor = new FootageDecodeCursor(new CountingDecoder(TEN_FPS), { startSec: 0, endSec: 0.3 });

    expect((await cursor.frameAt(5))?.timestamp).toBe(0.2);
  });

  it('never has more than two frames out, and hands every one back', async () => {
    const decoder = new CountingDecoder(TEN_FPS);
    const cursor = new FootageDecodeCursor(decoder, { startSec: 0, endSec: Infinity });

    for (const moment of [0, 0.7, 0.2, 1.5]) await cursor.frameAt(moment);
    await cursor.close();

    expect(decoder.maxOpen).toBeLessThanOrEqual(2);
    expect(decoder.open).toBe(0);
  });
});
