import { describe, expect, it } from 'vitest';
import { GifFileReader } from '@modules/video/animation/GifFileReader';
import { GifFrameComposer } from '@modules/video/animation/GifFrameComposer';
import { GifLzwDecoder } from '@modules/video/animation/GifLzwDecoder';
import { GifFixtureWriter, type FixtureColour, type FixtureGif } from '@modules/video/animation/GifFixtureWriter.fixture';

/**
 * A GIF decoded in script shows what a browser shows: each frame's
 * pixels from its own colour table or the global one, its transparent
 * index drawing nothing, its rows de-interlaced, and the frame before it
 * disposed of the way it asks. Whatever order its frames are asked in,
 * each one is the same picture.
 */

const RED: FixtureColour = [255, 0, 0];
const GREEN: FixtureColour = [0, 255, 0];
const BLUE: FixtureColour = [0, 0, 255];
const WHITE: FixtureColour = [255, 255, 255];
const PALETTE = [RED, GREEN, BLUE, WHITE];
const NOTHING = [0, 0, 0, 0];

const writer = new GifFixtureWriter();

function composerOf(gif: FixtureGif | Uint8Array): GifFrameComposer {
  const bytes = gif instanceof Uint8Array ? gif : writer.write(gif);
  const file = new GifFileReader().read(bytes);
  if (file === null) throw new Error('The fixture is not a GIF.');
  return new GifFrameComposer(file, new GifLzwDecoder());
}

/** Every pixel of frame `index`, as [r, g, b, a] row by row. */
function pixelsOf(composer: GifFrameComposer, index: number): number[][] {
  const canvas = composer.compose(index);
  const pixels: number[][] = [];
  for (let at = 0; at < canvas.length; at += 4) pixels.push([...canvas.subarray(at, at + 4)]);
  return pixels;
}

function opaque(colour: FixtureColour): number[] {
  return [...colour, 255];
}

function fill(count: number, index: number): number[] {
  return new Array<number>(count).fill(index);
}

/** A pseudo-random index sequence, the same on every run. */
function noise(count: number, colours: number, seed: number): number[] {
  let state = seed;
  return Array.from({ length: count }, () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return (state >> 8) % colours;
  });
}

describe('composing the frames of a GIF', () => {
  it('draws each frame over what the frame before it left', () => {
    const composer = composerOf({
      width: 2,
      height: 2,
      globalPalette: PALETTE,
      frames: [
        { width: 2, height: 2, indices: [0, 0, 0, 0] },
        { left: 1, top: 1, width: 1, height: 1, indices: [2] },
      ],
    });

    expect(pixelsOf(composer, 0)).toEqual([opaque(RED), opaque(RED), opaque(RED), opaque(RED)]);
    expect(pixelsOf(composer, 1)).toEqual([opaque(RED), opaque(RED), opaque(RED), opaque(BLUE)]);
  });

  it('draws nothing where a frame shows its transparent index', () => {
    const composer = composerOf({
      width: 3,
      height: 1,
      globalPalette: PALETTE,
      frames: [
        { width: 3, height: 1, indices: [1, 3, 1], transparentIndex: 3 },
        { width: 3, height: 1, indices: [2, 2, 0], transparentIndex: 2 },
      ],
    });

    expect(pixelsOf(composer, 0)).toEqual([opaque(GREEN), NOTHING, opaque(GREEN)]);
    expect(pixelsOf(composer, 1)).toEqual([opaque(GREEN), NOTHING, opaque(RED)]);
  });

  it('puts the rows of an interlaced frame where they belong', () => {
    const rows = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2];
    const composer = composerOf({
      width: 1,
      height: rows.length,
      globalPalette: PALETTE,
      frames: [{ width: 1, height: rows.length, indices: rows, interlaced: true }],
    });

    expect(pixelsOf(composer, 0)).toEqual(rows.map((index) => opaque(PALETTE[index]!)));
  });

  it('draws in black a frame with no colour table at all, as Chromium does', () => {
    const composer = composerOf({ width: 2, height: 1, frames: [{ width: 2, height: 1, indices: [0, 3], transparentIndex: 3 }] });

    expect(pixelsOf(composer, 0)).toEqual([[0, 0, 0, 255], NOTHING]);
  });

  it('uses a frame\'s own colour table over the global one', () => {
    const composer = composerOf({
      width: 2,
      height: 1,
      globalPalette: PALETTE,
      frames: [
        { width: 2, height: 1, indices: [0, 1] },
        { width: 2, height: 1, indices: [0, 1], localPalette: [WHITE, BLUE] },
        { width: 2, height: 1, indices: [1, 0] },
      ],
    });

    expect(pixelsOf(composer, 1)).toEqual([opaque(WHITE), opaque(BLUE)]);
    expect(pixelsOf(composer, 2)).toEqual([opaque(GREEN), opaque(RED)]);
  });

  describe('disposing of the frame before', () => {
    /** A red background, a blue pixel at the second place disposed of as asked, then a frame drawing nothing. */
    function afterDisposal(disposal: number): number[][] {
      const composer = composerOf({
        width: 2,
        height: 1,
        globalPalette: PALETTE,
        frames: [
          { width: 2, height: 1, indices: [0, 0] },
          { left: 1, width: 1, height: 1, indices: [2], disposal },
          { width: 1, height: 1, indices: [3], transparentIndex: 3 },
        ],
      });
      return pixelsOf(composer, 2);
    }

    it('keeps its area as drawn when it asks for nothing or to be kept', () => {
      expect(afterDisposal(0)).toEqual([opaque(RED), opaque(BLUE)]);
      expect(afterDisposal(1)).toEqual([opaque(RED), opaque(BLUE)]);
    });

    it('clears its area to transparent when it asks for the background', () => {
      expect(afterDisposal(2)).toEqual([opaque(RED), NOTHING]);
    });

    it('puts back what was under it when it asks for the previous picture, and reads 4 as that too', () => {
      expect(afterDisposal(3)).toEqual([opaque(RED), opaque(RED)]);
      expect(afterDisposal(4)).toEqual([opaque(RED), opaque(RED)]);
    });

    it('restores a first frame to nothing', () => {
      const composer = composerOf({
        width: 1,
        height: 1,
        globalPalette: PALETTE,
        frames: [
          { width: 1, height: 1, indices: [1], disposal: 3 },
          { width: 1, height: 1, indices: [3], transparentIndex: 3 },
        ],
      });

      expect(pixelsOf(composer, 1)).toEqual([NOTHING]);
    });
  });

  describe('decompressing a frame', () => {
    const colours: FixtureColour[] = Array.from({ length: 256 }, (_, index) => [index, 255 - index, (index * 7) & 0xff]);

    it.each([
      ['a two-bit code size', 4, 2, {}],
      ['an odd code size growing to twelve bits', 8, 3, {}],
      ['a five-bit code size', 32, 5, {}],
      ['codes growing to twelve bits and a clear code each time the table fills', 256, 8, {}],
      ['a full table kept without a clear code', 256, 8, { fullTable: 'keep' as const }],
      ['clear codes every few codes', 16, 4, { clearEvery: 7 }],
      ['a code size wider than the colour table needs', 4, 7, {}],
    ])('reads %s', (_, paletteSize, minCodeSize, options) => {
      const width = 64;
      const height = 48;
      const indices = noise(width * height, paletteSize, paletteSize * 31 + minCodeSize);
      const composer = composerOf({
        width,
        height,
        globalPalette: colours.slice(0, paletteSize),
        frames: [{ width, height, indices, minCodeSize, ...options }],
      });

      expect(pixelsOf(composer, 0)).toEqual(indices.map((index) => opaque(colours[index]!)));
    });

    it('reads long runs of one colour, whose codes name strings not in the table yet', () => {
      const indices = [...fill(500, 1), ...fill(300, 2), 0, ...fill(223, 1)];
      const composer = composerOf({
        width: 32,
        height: 32,
        globalPalette: PALETTE,
        frames: [{ width: 32, height: 32, indices }],
      });

      expect(pixelsOf(composer, 0)).toEqual(indices.map((index) => opaque(PALETTE[index]!)));
    });

    it('draws the pixels a frame cut short holds, and nothing past them', () => {
      const whole = writer.write({
        width: 16,
        height: 16,
        globalPalette: PALETTE,
        frames: [{ width: 16, height: 16, indices: noise(256, 4, 9) }],
      });
      const composer = composerOf(whole.subarray(0, whole.length - 30));

      const pixels = pixelsOf(composer, 0);
      const firstUndrawn = pixels.findIndex((pixel) => pixel[3] === 0);
      expect(firstUndrawn).toBeGreaterThan(0);
      expect(pixels.slice(firstUndrawn).every((pixel) => pixel[3] === 0)).toBe(true);
    });
  });

  describe('asking for frames in any order', () => {
    /**
     * Frames that build on each other, with every disposal method, a
     * frame covering the whole canvas part way through and one cleared
     * after covering it, so seeking has places to start over from.
     */
    const animation: FixtureGif = {
      width: 4,
      height: 4,
      globalPalette: PALETTE,
      frames: [
        { width: 4, height: 4, indices: fill(16, 0) },
        { left: 1, top: 1, width: 2, height: 2, indices: [1, 2, 3, 1], disposal: 3 },
        { left: 0, top: 2, width: 3, height: 2, indices: [2, 3, 2, 3, 2, 3], transparentIndex: 3, disposal: 1 },
        { width: 4, height: 4, indices: noise(16, 4, 3) },
        { left: 2, top: 0, width: 2, height: 2, indices: [0, 1, 1, 0], disposal: 2 },
        { width: 4, height: 4, indices: fill(16, 1), disposal: 2 },
        { left: 1, top: 1, width: 1, height: 3, indices: [2, 0, 2] },
        { left: 0, top: 0, width: 2, height: 1, indices: [3, 3], interlaced: true },
      ],
    };

    it('answers every frame the same as when they are composed in order', () => {
      const inOrder = animation.frames.map((_, index) => pixelsOf(composerOf(animation), index));
      const composer = composerOf(animation);
      const order = [7, 2, 5, 0, 6, 3, 3, 1, 7, 4, 0, 5, 2];

      for (const index of order) expect(pixelsOf(composer, index)).toEqual(inOrder[index]);
    });

    it('composes from the start again after a frame that cannot be drawn', () => {
      const composer = composerOf({
        width: 1,
        height: 1,
        globalPalette: PALETTE,
        frames: [
          { width: 1, height: 1, indices: [1] },
          { width: 1, height: 1, indices: [0], minCodeSize: 12 },
          { width: 1, height: 1, indices: [2], transparentIndex: 3 },
        ],
      });

      expect(() => composer.compose(1)).toThrow();
      expect(pixelsOf(composer, 0)).toEqual([opaque(GREEN)]);
      expect(() => composer.compose(2)).toThrow();
    });
  });
});
