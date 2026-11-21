import { describe, expect, it } from 'vitest';
import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import { FootageOcclusion } from '@modules/video/FootageOcclusion';

/**
 * Only an opaque picture covering the whole frame, square-cornered and
 * at rest, hides what lies beneath it; anything that may let the frame
 * show through, or around it, does not.
 */

const WHOLE = { x: 0, y: 0, width: 1, height: 1 };

function state(values: Partial<FootageLayerFrameState>): FootageLayerFrameState {
  return {
    assetRect: WHOLE,
    fit: 'cover',
    position: { x: { share: 0.5, offset: 0 }, y: { share: 0.5, offset: 0 } },
    cornerRadius: 0,
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
  };
}

describe('whether a layer hides everything beneath it', () => {
  it('is true of a video covering the whole frame square-cornered, at rest', () => {
    expect(new FootageOcclusion('video', state({})).hidesWholeFrame(1080, 1920)).toBe(true);
  });

  it('is false of a picture or a GIF over the whole frame, which may be transparent', () => {
    expect(new FootageOcclusion('image', state({})).hidesWholeFrame(1080, 1920)).toBe(false);
    expect(new FootageOcclusion('gif', state({})).hidesWholeFrame(1080, 1920)).toBe(false);
  });

  it('is false of a video fitted inside the frame, rounded, or drawn in part of it', () => {
    expect(new FootageOcclusion('video', state({ fit: 'contain' })).hidesWholeFrame(1080, 1920)).toBe(false);
    expect(new FootageOcclusion('video', state({ cornerRadius: 0.05 })).hidesWholeFrame(1080, 1920)).toBe(false);
    expect(new FootageOcclusion('video', state({ assetRect: { x: 0, y: 0, width: 1, height: 0.5 } })).hidesWholeFrame(1080, 1920)).toBe(false);
  });

  it('is false of a full-frame video while it is faded, moved or blurred', () => {
    expect(new FootageOcclusion('video', state({ opacity: 0.5 })).hidesWholeFrame(1080, 1920)).toBe(false);
    expect(new FootageOcclusion('video', state({ transform: { a: 0.9, b: 0, c: 0, d: 0.9, e: 0, f: 0 } })).hidesWholeFrame(1080, 1920)).toBe(false);
    expect(new FootageOcclusion('video', state({ blur: 0.01 })).hidesWholeFrame(1080, 1920)).toBe(false);
  });

  it('is true of the source\'s own picture covering the whole frame at rest, which is as opaque as a video', () => {
    expect(new FootageOcclusion('source-picture', state({})).hidesWholeFrame(1080, 1920)).toBe(true);
    expect(new FootageOcclusion('source-picture', state({ opacity: 0.5 })).hidesWholeFrame(1080, 1920)).toBe(false);
  });
});
