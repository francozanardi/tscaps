import { describe, expect, it } from 'vitest';
import { ShotVideoFraming } from '@core/shots/domain/ShotVideoFraming';
import { ShotCameraFrameGeometry } from '@presentation/shots/services/ShotCameraFrameGeometry';

/** A shot's framing is picked as the part of the frame it keeps in view, and read back from it. */

const geometry = new ShotCameraFrameGeometry();
const CENTRE = { x: 0.5, y: 0.5 };

describe('ShotCameraFrameGeometry', () => {
  it('keeps the whole frame in view at the frame\'s own size', () => {
    expect(geometry.rectOf(ShotVideoFraming.at(1, null, null), CENTRE)).toEqual({ left: 0, top: 0, width: 1, height: 1 });
  });

  it('keeps a half of each side twice as close, placed by its share of what is cropped away', () => {
    expect(geometry.rectOf(ShotVideoFraming.at(2, 0, 1), CENTRE)).toEqual({ left: 0, top: 0.5, width: 0.5, height: 0.5 });
  });

  it('places a view the framing does not place where the frame crops', () => {
    expect(geometry.rectOf(ShotVideoFraming.at(2, null, null), { x: 1, y: 0.5 }).left).toBe(0.5);
  });

  it('centres a view on a point, stopping at the frame\'s edges', () => {
    const framing = ShotVideoFraming.at(2, null, null);

    expect(geometry.centredAt(framing, { x: 0.5, y: 0.25 })).toMatchObject({ x: 0.5, y: 0 });
    expect(geometry.centredAt(framing, { x: 0.95, y: 0.6 })).toMatchObject({ x: 1, y: 0.7 });
  });

  it('places a view on the whole video along the axis a filled frame crops, as the stage does', () => {
    // A 16:9 video in 9:16: the picture is the whole video, about 3.16 frames wide.
    const span = { x: (16 / 9) / (9 / 16), y: 1 };
    const rect = geometry.rectOf(ShotVideoFraming.at(1, 1, null), CENTRE, span);

    expect(rect.width).toBeCloseTo(9 / 16 / (16 / 9), 6);
    expect(rect.left + rect.width).toBeCloseTo(1, 6);
    expect(rect.height).toBe(1);
  });

  it('moves a view at the frame\'s size along the whole video, and keeps the axis it fills', () => {
    const span = { x: 3, y: 1 };
    const moved = geometry.centredAt(ShotVideoFraming.at(1, null, null), { x: 0.6, y: 0.2 }, span);

    expect(moved.x).toBeCloseTo((0.6 - 1 / 6) / (1 - 1 / 3), 6);
    expect(moved.y).toBeNull();
    expect(geometry.canMove(ShotVideoFraming.at(1, null, null), span)).toBe(true);
    expect(geometry.canMove(ShotVideoFraming.at(1, null, null))).toBe(false);
  });

  it('closes in on the centre of the view it had', () => {
    const scaled = geometry.scaledTo(ShotVideoFraming.at(2, 0, 0), 3, CENTRE);

    // The view was the top-left quarter, centred at 0.25; a third wide around it starts a sixth before.
    expect(geometry.rectOf(scaled, CENTRE).left).toBeCloseTo(0.25 - 1 / 6, 6);
    expect(geometry.rectOf(scaled, CENTRE).width).toBeCloseTo(1 / 3, 6);
  });
});
