import { describe, expect, it } from 'vitest';
import { PictureChangeDetector } from '@core/preview/services/PictureChangeDetector';

/**
 * Where a video's picture changes, read off small thumbnails of its
 * frames. The promise is about which frames are reported: an edit or a
 * switch of camera is, while a camera that moves, a speaker who moves
 * and the grain of the picture are not.
 */

const SIZE = 32;
const FPS = 30;

/** A thumbnail whose every pixel is drawn by `colourAt`. */
function frameOf(colourAt: (x: number, y: number) => readonly [number, number, number]): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const [red, green, blue] = colourAt(x, y);
      pixels.set([red, green, blue, 255], (y * SIZE + x) * 4);
    }
  }
  return pixels;
}

/** A warm room: a light wall with a dark figure at `offset`. */
function roomAt(offset: number): Uint8ClampedArray {
  return frameOf((x, y) => {
    const insideFigure = Math.abs(x - 16 - offset) < 5 && y > 8;
    return insideFigure ? [60, 40, 30] : [210, 180, 140];
  });
}

/** A cold street: a blue sky over a grey road. */
function street(): Uint8ClampedArray {
  return frameOf((_x, y) => (y < 14 ? [90, 140, 220] : [100, 100, 105]));
}

/** `base` with every channel moved by up to `amount`, deterministically per frame. */
function grainy(base: Uint8ClampedArray, seed: number, amount: number): Uint8ClampedArray {
  const pixels = base.slice();
  let state = seed * 9301 + 49297;
  for (let offset = 0; offset < pixels.length; offset += 1) {
    if (offset % 4 === 3) continue;
    state = (state * 9301 + 49297) % 233280;
    pixels[offset] = pixels[offset]! + Math.round(((state / 233280) * 2 - 1) * amount);
  }
  return pixels;
}

function changesIn(frames: ReadonlyArray<Uint8ClampedArray>): number[] {
  const detector = new PictureChangeDetector();
  frames.forEach((frame, index) => detector.observe(index / FPS, frame));
  return detector.changes();
}

function repeated(count: number, frameAt: (index: number) => Uint8ClampedArray): Uint8ClampedArray[] {
  return Array.from({ length: count }, (_, index) => frameAt(index));
}

describe('PictureChangeDetector', () => {
  it('reports the first frame of a new picture', () => {
    const frames = [...repeated(30, () => roomAt(0)), ...repeated(30, () => street())];

    expect(changesIn(frames)).toEqual([30 / FPS]);
  });

  it('reports every edit, back to back', () => {
    const frames = [
      ...repeated(20, () => roomAt(0)),
      ...repeated(20, () => street()),
      ...repeated(20, () => roomAt(4)),
    ];

    expect(changesIn(frames)).toEqual([20 / FPS, 40 / FPS]);
  });

  it('takes a speaker moving across the frame for one picture', () => {
    expect(changesIn(repeated(60, (index) => roomAt(Math.round(Math.sin(index / 6) * 8))))).toEqual([]);
  });

  it('takes the grain of the picture for one picture', () => {
    expect(changesIn(repeated(60, (index) => grainy(roomAt(0), index, 12)))).toEqual([]);
  });

  it('finds an edit inside footage that is moving and grainy', () => {
    const frames = [
      ...repeated(30, (index) => grainy(roomAt(Math.round(Math.sin(index / 4) * 6)), index, 10)),
      ...repeated(30, (index) => grainy(street(), index + 30, 10)),
    ];

    expect(changesIn(frames)).toEqual([30 / FPS]);
  });

  it('does not report a fade, which no single frame of stands out in', () => {
    const from = roomAt(0);
    const to = street();
    // Grain spreads the colours as real footage does; a flat synthetic
    // colour crosses a histogram bin all at once.
    const frames = repeated(60, (index) => {
      const weight = Math.min(1, Math.max(0, (index - 15) / 30));
      const blended = from.map((value, offset) => Math.round(value * (1 - weight) + to[offset]! * weight));
      return grainy(blended, index, 12);
    });

    expect(changesIn(frames)).toEqual([]);
  });

  it('has nothing to say about a single frame, or none', () => {
    expect(changesIn([])).toEqual([]);
    expect(changesIn([roomAt(0)])).toEqual([]);
  });
});
