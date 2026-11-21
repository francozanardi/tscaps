import { describe, expect, it } from 'vitest';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';

/**
 * A frame's size keeps the video's shorter side, at even sides; a stored
 * frame is read field by field, a bad value falling back; and a filled
 * video is cropped on the axis its shape overflows.
 */

const ORIGINAL = OutputFrame.original();
const LANDSCAPE = { width: 1920, height: 1080 };
const PORTRAIT = { width: 1080, height: 1920 };

describe('OutputFrame', () => {
  it.each([
    ['9:16', LANDSCAPE, { width: 1080, height: 1920 }],
    ['1:1', LANDSCAPE, { width: 1080, height: 1080 }],
    ['4:5', PORTRAIT, { width: 1080, height: 1350 }],
    ['16:9', PORTRAIT, { width: 1920, height: 1080 }],
    ['9:16', { width: 1279, height: 721 }, { width: 720, height: 1280 }],
  ] as const)('sizes a %s frame for a video of %o as %o', (format, video, expected) => {
    expect(ORIGINAL.withFormat(format).layoutFor(video)).toEqual(expected);
  });

  it('is the video\'s own size for the original shape, and nothing while the video\'s size is not known', () => {
    expect(ORIGINAL.layoutFor(LANDSCAPE)).toEqual(LANDSCAPE);
    expect(ORIGINAL.withFormat('1:1').layoutFor(null)).toBeNull();
  });

  it('reads a stored frame, falling back where a value is missing or out of range', () => {
    const read = OutputFrame.fromSnapshot({
      format: '4:5',
      fit: 'stretch' as never,
      backdrop: 'black',
      position: { x: 1.5, y: Number.NaN },
    });

    expect(read.toSnapshot()).toEqual({ format: '4:5', fit: 'fill', backdrop: 'black', position: { x: 1, y: 0.5 } });
    expect(OutputFrame.fromSnapshot(undefined).equals(ORIGINAL)).toBe(true);
    expect(OutputFrame.fromSnapshot({ format: '3:2' as never }).isOriginal()).toBe(true);
  });

  it('crops a filled video on the axis it overflows, and none where it fits or keeps its shape', () => {
    const vertical = ORIGINAL.withFormat('9:16');

    expect(vertical.croppedAxis(LANDSCAPE)).toBe('x');
    expect(ORIGINAL.withFormat('16:9').croppedAxis(PORTRAIT)).toBe('y');
    expect(vertical.croppedAxis(PORTRAIT)).toBeNull();
    expect(vertical.withFit('fit').croppedAxis(LANDSCAPE)).toBeNull();
    expect(ORIGINAL.croppedAxis(LANDSCAPE)).toBeNull();
  });
});
