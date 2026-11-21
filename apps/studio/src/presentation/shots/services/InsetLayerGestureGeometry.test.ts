import { describe, expect, it } from 'vitest';
import type { InsetShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import {
  InsetLayerGestureGeometry,
  type InsetLayerGestureStart,
} from '@presentation/shots/services/InsetLayerGestureGeometry';

/**
 * Dragging a box over the video: a move carries its centre with the
 * pointer and pulls it onto the frame's centre lines; a corner resizes
 * it from the opposite corner, keeping its shape; and the box never
 * crosses the padding, so what is stored is where the box is drawn.
 */

const gestures = new InsetLayerGestureGeometry({
  vertical: { center: 0.5, radius: 0.025 },
  horizontal: { center: 0.5, radius: 0.02 },
});
const VERTICAL = { width: 1080, height: 1920 };

const BOX: InsetShotLayerPlacement = {
  kind: 'inset', subject: 'asset', centerX: 0.3, centerY: 0.3, width: 0.4, aspectRatio: 1, padding: 0.04, cornerRadius: 0.04, fit: 'cover',
};
// Where BOX rests on VERTICAL: 432 px square, which is 0.225 of the height.
const BOX_RECT = { x: 0.1, y: 0.3 - 0.225 / 2, width: 0.4, height: 0.225 };
// 0.04 of 1080 px, on each axis.
const PADDING_X = 0.04;
const PADDING_Y = 43.2 / 1920;

function startFrom(placement: InsetShotLayerPlacement, rect = BOX_RECT): InsetLayerGestureStart {
  return { placement, rect, frame: VERTICAL };
}

describe('InsetLayerGestureGeometry', () => {
  it('carries the box\'s centre with the pointer', () => {
    const { placement } = gestures.moved(startFrom(BOX), 0.1, 0.05);

    expect(placement.centerX).toBeCloseTo(0.4);
    expect(placement.centerY).toBeCloseTo(0.35);
    expect(placement.width).toBeCloseTo(BOX.width);
  });

  it('pulls a centre that comes close onto the frame\'s centre lines, and says so', () => {
    const result = gestures.moved(startFrom(BOX), 0.21, 0.185);

    expect([result.placement.centerX, result.placement.centerY]).toEqual([0.5, 0.5]);
    expect([result.snappedToVerticalCentre, result.snappedToHorizontalCentre]).toEqual([true, true]);
  });

  it('stops a box dragged past the padding at it, so the next drag starts from what is seen', () => {
    const { placement } = gestures.moved(startFrom(BOX), -0.5, -0.5);

    expect(placement.centerX).toBeCloseTo(PADDING_X + BOX_RECT.width / 2);
    expect(placement.centerY).toBeCloseTo(PADDING_Y + BOX_RECT.height / 2);
  });

  it('stores the width the box is drawn at, where it is drawn narrower than its setting', () => {
    const { placement } = gestures.moved(startFrom({ ...BOX, width: 0.9 }), 0, 0);

    expect(placement.width).toBeCloseTo(BOX_RECT.width);
  });

  it('keeps the corner opposite the one dragged where it stood', () => {
    const { placement } = gestures.resized(startFrom(BOX), 'br', BOX_RECT.x + 0.5, BOX_RECT.y + 0.1);
    const height = BOX_RECT.height * (0.5 / BOX_RECT.width);

    expect(placement.width).toBeCloseTo(0.5);
    expect(placement.centerX - placement.width / 2).toBeCloseTo(BOX_RECT.x);
    expect(placement.centerY - height / 2).toBeCloseTo(BOX_RECT.y);
  });

  it('keeps the box\'s shape whichever way the pointer leans', () => {
    const anchorX = BOX_RECT.x + BOX_RECT.width;
    const anchorY = BOX_RECT.y + BOX_RECT.height;

    const { placement } = gestures.resized(startFrom(BOX), 'tl', BOX_RECT.x - 0.02, BOX_RECT.y - 0.15);

    expect((anchorX - placement.centerX) / (anchorY - placement.centerY)).toBeCloseTo(BOX_RECT.width / BOX_RECT.height);
    expect(placement.aspectRatio).toBe(1);
  });

  it('leaves a box following its file\'s shape following it', () => {
    const { placement } = gestures.resized(startFrom({ ...BOX, aspectRatio: null }), 'br', BOX_RECT.x + 0.3, BOX_RECT.y + 0.3);

    expect(placement.aspectRatio).toBeNull();
  });

  it('stops growing at the padding, the corner it grows from holding still', () => {
    const { placement } = gestures.resized(startFrom(BOX), 'br', 2, 2);

    expect(placement.width).toBeCloseTo(1 - PADDING_X - BOX_RECT.x);
    expect(placement.centerX - placement.width / 2).toBeCloseTo(BOX_RECT.x);
  });

  it('stops shrinking at the narrowest box a placement may hold, even past the opposite corner', () => {
    const { placement } = gestures.resized(startFrom(BOX), 'br', BOX_RECT.x - 0.2, BOX_RECT.y - 0.2);

    expect(placement.width).toBeCloseTo(0.1);
  });
});
