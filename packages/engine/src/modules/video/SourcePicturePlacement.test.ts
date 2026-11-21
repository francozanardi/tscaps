import { describe, expect, it } from 'vitest';
import type { FootageCompositionRequest, FootageLayerPicture } from '@modules/video/FootageCompositor';
import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import { SourcePicturePlacement } from '@modules/video/SourcePicturePlacement';

/**
 * Where the source's own picture lands is what a consumer drawing over a
 * composed frame places itself by — a mask measured on the bare video
 * must follow a crop, a zoom or a split — so it must say what the
 * compositor draws.
 */

const PICTURE = { draw: () => undefined };

function entry(kind: 'source-picture' | 'image' | 'video', state: Partial<FootageLayerFrameState> = {}): FootageLayerPicture {
  return {
    layer: {
      id: kind,
      source: kind === 'source-picture' ? { kind } : { kind, blob: new Blob() },
      outputStartSec: 0,
      outputEndSec: 1,
      sourceStartSec: 0,
      sourcePassSec: Infinity,
    },
    picture: PICTURE,
    width: 1920,
    height: 1080,
    state: { ...SourcePicturePlacement.coverAtRest({ x: 0, y: 0, width: 1, height: 1 }), ...state },
  };
}

function request(layers: FootageLayerPicture[]): FootageCompositionRequest {
  return { width: 1080, height: 1920, video: PICTURE, videoWidth: 1920, videoHeight: 1080, layers };
}

describe('where the source\'s own picture lands', () => {
  it('covers the frame, centred, where no layer is active, at the frame\'s size from the picture\'s', () => {
    expect(new SourcePicturePlacement(request([])).placed()).toEqual({
      state: SourcePicturePlacement.coverAtRest({ x: 0, y: 0, width: 1, height: 1 }),
      frameWidth: 1080,
      frameHeight: 1920,
      pictureWidth: 1920,
      pictureHeight: 1080,
    });
  });

  it('is the topmost layer showing it, in its own state, over a blurred copy beneath', () => {
    const closer = { assetRect: { x: 0, y: -1, width: 2, height: 2 } };
    const placed = new SourcePicturePlacement(request([entry('source-picture', { blur: 0.04 }), entry('source-picture', closer)])).placed();

    expect(placed?.state.assetRect).toEqual(closer.assetRect);
    expect(placed?.state.blur).toBe(0);
  });

  it('is re-framed into the part a split leaves the video', () => {
    const half = { x: 0, y: 0.5, width: 1, height: 0.5 };
    const placed = new SourcePicturePlacement(request([entry('source-picture'), entry('image', { videoRect: half })])).placed();

    expect(placed?.state.assetRect).toEqual(half);
  });

  it('is nowhere where a video above it hides the whole frame, and beneath a picture, which may be see-through', () => {
    expect(new SourcePicturePlacement(request([entry('source-picture'), entry('video')])).placed()).toBeNull();
    expect(new SourcePicturePlacement(request([entry('video')])).placed()).toBeNull();
    expect(new SourcePicturePlacement(request([entry('image')])).placed()).not.toBeNull();
  });

  it('is the rect a layer draws the video over itself in, with its rounded corners, even over a whole-frame cover', () => {
    const corner = { x: 0.6, y: 0.6, width: 0.3, height: 0.3 };
    const placed = new SourcePicturePlacement(request([
      entry('video', { videoRect: corner, videoAbove: true, videoCornerRadius: 0.05 }),
    ])).placed();

    expect(placed?.state.assetRect).toEqual(corner);
    expect(placed?.state.cornerRadius).toBe(0.05);
  });
});
