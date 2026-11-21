import { describe, expect, it } from 'vitest';
import { AnimatedImageFootage } from '@modules/video/animation/AnimatedImageFootage';
import type { AnimationFrame, AnimationFrameDecoder } from '@modules/video/animation/AnimationFrameDecoder';
import { AnimationFrameTimeline } from '@modules/video/animation/AnimationFrameTimeline';
import type { FootagePicture } from '@modules/video/FootagePicture';

/**
 * An animation shows each frame for its own duration, starts over once
 * it runs out, and holds one decoded frame at a time. A frame that will
 * not decode leaves the one before it on show instead of failing.
 */

/** Decodes frame `i` as a picture that draws its index; remembers which frames are still open. */
class FakeFrameDecoder implements AnimationFrameDecoder {
  readonly width = 4;
  readonly height = 2;
  readonly open = new Set<number>();
  closed = false;

  constructor(readonly frameCount: number, private readonly failing: ReadonlySet<number> = new Set()) {}

  decode(frameIndex: number): Promise<AnimationFrame> {
    if (this.failing.has(frameIndex)) return Promise.reject(new Error(`frame ${frameIndex} is broken`));
    this.open.add(frameIndex);
    return Promise.resolve({
      draw: (context) => { (context as unknown as DrawnFrames).drawn.push(frameIndex); },
      close: () => { this.open.delete(frameIndex); },
    });
  }

  close(): void {
    this.closed = true;
  }
}

interface DrawnFrames {
  drawn: number[];
}

/** The index of the frame `picture` draws, or null for none. */
function drawnBy(picture: FootagePicture | null): number | null {
  if (picture === null) return null;
  const context = { drawn: [] as number[] };
  picture.draw(context as unknown as CanvasRenderingContext2D, 0, 0, 1, 1);
  return context.drawn.at(-1) ?? null;
}

function footage(durationsSec: number[], decoder = new FakeFrameDecoder(durationsSec.length)): AnimatedImageFootage {
  return new AnimatedImageFootage(new AnimationFrameTimeline(durationsSec), decoder);
}

describe('an animated image as footage', () => {
  it('shows each frame for its own duration', async () => {
    const gif = footage([0.1, 0.3, 0.2]);

    expect(drawnBy(await gif.pictureAt(0))).toBe(0);
    expect(drawnBy(await gif.pictureAt(0.099))).toBe(0);
    expect(drawnBy(await gif.pictureAt(0.1))).toBe(1);
    expect(drawnBy(await gif.pictureAt(0.399))).toBe(1);
    expect(drawnBy(await gif.pictureAt(0.4))).toBe(2);
  });

  it('starts over once it runs out, for as long as it is asked', async () => {
    const gif = footage([0.1, 0.3, 0.2]);

    expect(drawnBy(await gif.pictureAt(0.6))).toBe(0);
    expect(drawnBy(await gif.pictureAt(0.75))).toBe(1);
    expect(drawnBy(await gif.pictureAt(6.05))).toBe(0);
    expect(drawnBy(await gif.pictureAt(6.5))).toBe(2);
  });

  it('answers the same frame for the same moment whatever was asked before', async () => {
    const forward = footage([0.1, 0.3, 0.2]);
    const jumping = footage([0.1, 0.3, 0.2]);

    await forward.pictureAt(0.05);
    await forward.pictureAt(0.2);
    await jumping.pictureAt(5.95);

    expect(drawnBy(await forward.pictureAt(2.15))).toBe(drawnBy(await jumping.pictureAt(2.15)));
  });

  it('holds one decoded frame at a time, and none once closed', async () => {
    const decoder = new FakeFrameDecoder(3);
    const gif = footage([0.1, 0.1, 0.1], decoder);

    for (const sec of [0, 0.1, 0.2, 0.3, 0.45]) await gif.pictureAt(sec);
    expect([...decoder.open]).toEqual([1]);

    await gif.close();
    expect(decoder.open.size).toBe(0);
    expect(decoder.closed).toBe(true);
  });

  it('answers the latest of the moments asked while a frame is being decoded', async () => {
    const gif = footage([0.1, 0.1, 0.1]);

    const answers = await Promise.all([gif.pictureAt(0), gif.pictureAt(0.15), gif.pictureAt(0.25)]);

    expect(drawnBy(answers.at(-1)!)).toBe(2);
  });

  it('keeps the frame before on show where a frame will not decode', async () => {
    const gif = footage([0.1, 0.1, 0.1], new FakeFrameDecoder(3, new Set([1])));

    await gif.pictureAt(0);

    expect(drawnBy(await gif.pictureAt(0.15))).toBe(0);
    expect(drawnBy(await gif.pictureAt(0.25))).toBe(2);
  });

  it('holds no picture while not even its first frame decodes', async () => {
    const gif = footage([0.1, 0.1], new FakeFrameDecoder(2, new Set([0])));

    expect(await gif.pictureAt(0)).toBeNull();
  });

  it('shows its first frame for good when it lasts nothing at all', async () => {
    const gif = footage([0, 0]);

    expect(drawnBy(await gif.pictureAt(3))).toBe(0);
  });
});
