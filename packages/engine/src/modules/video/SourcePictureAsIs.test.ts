import { describe, expect, it } from 'vitest';
import type { FootageCompositionRequest, FootageLayerPicture } from '@modules/video/FootageCompositor';
import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import { SourcePictureAsIs } from '@modules/video/SourcePictureAsIs';

/**
 * A frame is the source's frame untouched only where every layer on it
 * shows the source's picture and the topmost draws it whole, at rest,
 * at the frame's own shape. Anything else needs composing.
 */

const PICTURE = { draw: () => undefined };
const CENTRED = { share: 0.5, offset: 0 };

function state(values: Partial<FootageLayerFrameState> = {}): FootageLayerFrameState {
  return {
    assetRect: { x: 0, y: 0, width: 1, height: 1 },
    fit: 'cover',
    position: { x: CENTRED, y: CENTRED },
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

function entry(kind: 'source-picture' | 'image', values: Partial<FootageLayerFrameState> = {}): FootageLayerPicture {
  return {
    layer: {
      id: kind,
      source: kind === 'image' ? { kind, blob: new Blob() } : { kind },
      outputStartSec: 0,
      outputEndSec: 1,
      sourceStartSec: 0,
      sourcePassSec: Infinity,
    },
    picture: PICTURE,
    width: 1080,
    height: 1920,
    state: state(values),
  };
}

function request(layers: FootageLayerPicture[], videoWidth = 1080, videoHeight = 1920): FootageCompositionRequest {
  return { width: 720, height: 1280, video: PICTURE, videoWidth, videoHeight, layers };
}

const asIs = new SourcePictureAsIs();

describe('whether a frame is the source\'s frame untouched', () => {
  it('holds with no layer at all, where the video is of the frame\'s shape', () => {
    expect(asIs.holds(request([]))).toBe(true);
    expect(asIs.holds(request([], 1920, 1080))).toBe(false);
  });

  it('holds where the source\'s picture covers the frame at rest, at the frame\'s shape, wherever it is placed', () => {
    expect(asIs.holds(request([entry('source-picture', { position: { x: { share: 0, offset: 0 }, y: CENTRED } })]))).toBe(true);
  });

  it('holds where the shapes differ by less than a pixel of the frame', () => {
    expect(asIs.holds(request([entry('source-picture')], 1366, 2428))).toBe(true);
  });

  it('does not hold where the source\'s picture is moved, faded or cropped to another shape', () => {
    expect(asIs.holds(request([entry('source-picture', { transform: { a: 1.2, b: 0, c: 0, d: 1.2, e: 0, f: 0 } })]))).toBe(false);
    expect(asIs.holds(request([entry('source-picture', { opacity: 0.9 })]))).toBe(false);
    expect(asIs.holds(request([entry('source-picture')], 1920, 1080))).toBe(false);
  });

  it('does not hold where the source\'s picture is held closer, in a box grown past the frame', () => {
    expect(asIs.holds(request([entry('source-picture', { assetRect: { x: 0, y: -1, width: 2, height: 2 } })]))).toBe(false);
  });

  it('does not hold where any other footage shows, or the picture is re-framed', () => {
    expect(asIs.holds(request([entry('source-picture'), entry('image', { assetRect: { x: 0, y: 0, width: 0.2, height: 0.2 } })]))).toBe(false);
    expect(asIs.holds(request([entry('source-picture', { videoRect: { x: 0, y: 0.5, width: 1, height: 0.5 } })]))).toBe(false);
  });
});
