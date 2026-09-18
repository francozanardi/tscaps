import { describe, expect, it } from 'vitest';
import { ExportResolutionPresets } from '@presentation/export/services/ExportResolutionPresets';

const presets = new ExportResolutionPresets();

const FHD_BUDGET = 1920 * 1080;
const HD_BUDGET = 1280 * 720;

function labelsWithin(width: number, height: number, budget: number): readonly string[] {
  const capped = presets.cappedTo(presets.forInput(width, height), width, height, budget);
  return capped?.options.map((option) => option.label) ?? [];
}

function defaultShortSideWithin(
  width: number,
  height: number,
  budget: number,
): number | 'original' {
  const capped = presets.cappedTo(presets.forInput(width, height), width, height, budget);
  const resolution = capped?.defaultResolution;
  if (!resolution) throw new Error('the budget left no option');
  if (resolution === 'original') return 'original';
  return Math.min(resolution.width, resolution.height);
}

/**
 * Narrowing the dialog's choices to what a plan allows.
 *
 * **It has to measure what the server measures**, which is pixels in one
 * frame and nothing about shape. A dialog that filtered on a side would
 * offer a wide frame the enqueue then refuses, which is the one failure
 * this is here to prevent.
 */
describe('ExportResolutionPresets.cappedTo', () => {
  it('drops the source itself when it holds more pixels than the budget', () => {
    expect(labelsWithin(3840, 2160, FHD_BUDGET).some((l) => l.startsWith('Keep original')))
      .toBe(false);
  });

  it('keeps the source when it is already inside the budget', () => {
    expect(labelsWithin(1920, 1080, FHD_BUDGET).some((l) => l.startsWith('Keep original')))
      .toBe(true);
  });

  it('defaults to the largest that survives', () => {
    expect(defaultShortSideWithin(3840, 2160, FHD_BUDGET)).toBe(1080);
    expect(defaultShortSideWithin(3840, 2160, HD_BUDGET)).toBe(720);
  });

  it('defaults to the source when the budget does not bite', () => {
    expect(defaultShortSideWithin(1280, 720, FHD_BUDGET)).toBe('original');
  });

  it('treats a vertical source like the horizontal one of the same size', () => {
    expect(defaultShortSideWithin(2160, 3840, FHD_BUDGET)).toBe(1080);
    expect(labelsWithin(2160, 3840, FHD_BUDGET).some((l) => l.startsWith('Keep original')))
      .toBe(false);
  });

  it('refuses a wide frame that fits on both sides but not in the budget', () => {
    // 2560x1080 passes any 1080 short-side rule and is half again over a
    // 1080p budget. This is the case a per-side cap let through.
    expect(labelsWithin(2560, 1080, FHD_BUDGET).some((l) => l.startsWith('Keep original')))
      .toBe(false);
  });

  it('leaves a catalog untouched when nothing in it exceeds the budget', () => {
    const catalog = presets.forInput(1280, 720);
    const capped = presets.cappedTo(catalog, 1280, 720, 3840 * 2160);
    expect(capped?.options).toEqual(catalog.options);
    expect(capped?.defaultResolution).toBe(catalog.defaultResolution);
  });

  it('offers every step below the budget, not just the largest', () => {
    expect(labelsWithin(3840, 2160, FHD_BUDGET)).toEqual([
      'FHD (1080p)',
      'HD (720p)',
      'SD (480p)',
    ]);
  });

  it('answers null rather than an empty dropdown when the ceiling leaves nothing', () => {
    expect(presets.cappedTo(presets.forInput(640, 360), 640, 360, 320 * 240)).toBeNull();
  });
});
