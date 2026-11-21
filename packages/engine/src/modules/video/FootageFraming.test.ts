import { describe, expect, it } from 'vitest';
import { FootageFraming } from '@modules/video/FootageFraming';
import type { FootageFit, FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import type { FootageRect } from '@modules/video/FootageRect';

/**
 * A normalized rect lands on the frame in pixels; a picture covers it,
 * cropped and centred, or fits inside it, centred; the corners rounded
 * are those of what shows, by a fraction of the frame's shorter side and
 * never past a full round.
 */

const FRAME_WIDTH = 1000;
const FRAME_HEIGHT = 2000;
const WHOLE = { x: 0, y: 0, width: 1, height: 1 };

function framing(
  assetRect: FootageRect,
  fit: FootageFit,
  cornerRadius: number,
  values: Partial<FootageLayerFrameState> = {},
): FootageFraming {
  return new FootageFraming({
    assetRect,
    fit,
    position: { x: { share: 0.5, offset: 0 }, y: { share: 0.5, offset: 0 } },
    cornerRadius,
    opacity: 1,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    blur: 0,
    brightness: 1,
    backgroundColor: null,
    clipInset: { top: 0, right: 0, bottom: 0, left: 0 },
    videoRect: null,
    videoAbove: false,
    videoCornerRadius: 0,
    fillBlur: 0,
    clipRect: null,
    clipRadius: 0,
    ...values,
  }, FRAME_WIDTH, FRAME_HEIGHT);
}

describe('FootageFraming', () => {
  it('turns a normalized rect into pixels of the frame', () => {
    expect(framing({ x: 0.1, y: 0.5, width: 0.8, height: 0.25 }, 'cover', 0).box()).toEqual({ x: 100, y: 1000, width: 800, height: 500 });
  });

  it('covers the box with the picture, centred, reaching past it on one axis', () => {
    const covering = framing({ x: 0, y: 0, width: 1, height: 0.5 }, 'cover', 0);

    expect(covering.pictureBox(400, 200)).toEqual({ x: -500, y: 0, width: 2000, height: 1000 });
    expect(covering.visibleBox(400, 200)).toEqual({ x: 0, y: 0, width: 1000, height: 1000 });
  });

  it('fits the whole picture inside the box, centred, and only it shows', () => {
    const fitting = framing({ x: 0, y: 0, width: 1, height: 0.5 }, 'contain', 0);

    expect(fitting.pictureBox(400, 200)).toEqual({ x: 0, y: 250, width: 1000, height: 500 });
    expect(fitting.visibleBox(400, 200)).toEqual({ x: 0, y: 250, width: 1000, height: 500 });
  });

  it('rounds corners by a fraction of the frame\'s shorter side, at most into a full round', () => {
    const inset = { x: 0.25, y: 0.25, width: 0.5, height: 0.1 };

    expect(framing(inset, 'cover', 0.05).cornerRadiusPx(1, 1)).toBe(50);
    expect(framing(inset, 'cover', 0.5).cornerRadiusPx(1, 1)).toBe(100);
  });

  it('hides the whole frame only as a square-cornered cover of a rect holding all of it', () => {
    expect(framing(WHOLE, 'cover', 0).coversWholeFrame()).toBe(true);
    expect(framing(WHOLE, 'contain', 0).coversWholeFrame()).toBe(false);
    expect(framing(WHOLE, 'cover', 0.02).coversWholeFrame()).toBe(false);
    expect(framing({ x: 0, y: 0, width: 1, height: 0.9 }, 'cover', 0).coversWholeFrame()).toBe(false);
  });

  it('stands at rest only opaque, unmoved, sharp and uncut', () => {
    expect(framing(WHOLE, 'cover', 0).isAtRest()).toBe(true);
    expect(framing(WHOLE, 'cover', 0, { opacity: 0.99 }).isAtRest()).toBe(false);
    expect(framing(WHOLE, 'cover', 0, { transform: { a: 1, b: 0, c: 0, d: 1, e: 0.01, f: 0 } }).isAtRest()).toBe(false);
    expect(framing(WHOLE, 'cover', 0, { blur: 0.001 }).isAtRest()).toBe(false);
    expect(framing(WHOLE, 'cover', 0, { clipInset: { top: 0, right: 0.1, bottom: 0, left: 0 } }).isAtRest()).toBe(false);
  });

  it('places a covering picture at a share of the room it leaves, then moves it by a fraction of the frame', () => {
    const atRight = { x: { share: 1, offset: 0 }, y: { share: 0.5, offset: 0 } };
    const movedUp = { x: { share: 0, offset: 0.1 }, y: { share: 0.5, offset: -0.05 } };

    expect(framing(WHOLE, 'cover', 0, { position: atRight }).pictureBox(1920, 1080)).toEqual({ x: 1000 - 3555.5555555555557, y: 0, width: 3555.5555555555557, height: 2000 });
    expect(framing(WHOLE, 'cover', 0, { position: movedUp }).pictureBox(1920, 1080)).toEqual({ x: 100, y: -100, width: 3555.5555555555557, height: 2000 });
  });

  it('says a cover no longer hides the whole frame once its position may leave an edge bare', () => {
    const past = { x: { share: 1.2, offset: 0 }, y: { share: 0.5, offset: 0 } };
    const moved = { x: { share: 0.5, offset: 0.01 }, y: { share: 0.5, offset: 0 } };

    expect(framing(WHOLE, 'cover', 0, { position: past }).coversWholeFrame()).toBe(false);
    expect(framing(WHOLE, 'cover', 0, { position: moved }).coversWholeFrame()).toBe(false);
    expect(framing(WHOLE, 'cover', 0, { position: { x: { share: 0, offset: 0 }, y: { share: 1, offset: 0 } } }).coversWholeFrame()).toBe(true);
  });
});
