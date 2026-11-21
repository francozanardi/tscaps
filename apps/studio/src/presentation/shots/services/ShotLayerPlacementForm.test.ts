import { describe, expect, it } from 'vitest';
import type { InsetShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { ShotLayerBoxShape } from '@core/shots/domain/ShotLayerBoxShape';
import { ShotLayerPlacementSanitizer } from '@core/shots/domain/ShotLayerPlacementSanitizer';
import { ShotLayerPlacementForm } from '@presentation/shots/services/ShotLayerPlacementForm';

const sanitizer = new ShotLayerPlacementSanitizer();
const form = new ShotLayerPlacementForm(sanitizer, new ShotLayerBoxShape());

function inset(overrides: Partial<InsetShotLayerPlacement> = {}): InsetShotLayerPlacement {
  return {
    kind: 'inset', subject: 'asset', centerX: 0.5, centerY: 0.5, width: 0.4, aspectRatio: null, padding: 0.04, cornerRadius: 0.04, fit: 'cover',
    ...overrides,
  };
}

describe('ShotLayerPlacementForm', () => {
  it('reads back every box shape it writes, through what storage does to it', () => {
    for (const preset of form.aspectPresets()) {
      const written = form.withAspectPreset(inset(), preset);
      const stored = sanitizer.sanitize(JSON.parse(JSON.stringify(written))) as InsetShotLayerPlacement;
      expect(form.aspectPresetOf(stored)).toBe(preset);
    }
  });

  it('names no preset for a shape none of them is', () => {
    expect(form.aspectPresetOf(inset({ aspectRatio: 1.3 }))).toBeNull();
  });

  it('reads back every place across and down the frame it writes', () => {
    for (const horizontal of form.horizontalAnchors()) {
      for (const vertical of form.verticalAnchors()) {
        const written = form.withVerticalAnchor(form.withHorizontalAnchor(inset(), horizontal), vertical);
        expect(form.horizontalAnchorOf(written)).toBe(horizontal);
        expect(form.verticalAnchorOf(written)).toBe(vertical);
      }
    }
  });

  it('moves the box along one axis only, keeping where it was dragged on the other', () => {
    const dragged = inset({ centerX: 0.3, centerY: 0.62 });
    expect(form.withHorizontalAnchor(dragged, 'right')).toEqual({ ...dragged, centerX: 1 });
    expect(form.withVerticalAnchor(dragged, 'top')).toEqual({ ...dragged, centerY: 0 });
  });

  it('names no place on an axis where the box was left somewhere else', () => {
    const dragged = inset({ centerX: 0.3, centerY: 0.5 });
    expect(form.horizontalAnchorOf(dragged)).toBeNull();
    expect(form.verticalAnchorOf(dragged)).toBe('center');
    expect(form.verticalAnchorOf(inset({ centerY: 0.71 }))).toBeNull();
  });

  it('keeps the settings of the layout already picked, and how the asset fills its box across a change', () => {
    const current = inset({ width: 0.7, fit: 'contain' });
    expect(form.withLayout(current, 'inset')).toBe(current);
    expect(form.withLayout(current, 'split')).toEqual({ ...sanitizer.fresh('split'), fit: 'contain' });
  });

  it('calls the ends of a split by where the geometry actually cuts the frame', () => {
    expect(form.splitSideLabels(9 / 16)).toEqual({ start: 'Top', end: 'Bottom' });
    expect(form.splitSideLabels(1)).toEqual({ start: 'Top', end: 'Bottom' });
    expect(form.splitSideLabels(null)).toEqual({ start: 'Top', end: 'Bottom' });
    expect(form.splitSideLabels(16 / 9)).toEqual({ start: 'Left', end: 'Right' });
  });

  it('crops a file filling its box on the axis it overflows, and nothing that fits or matches its box', () => {
    const portrait = 9 / 16;

    expect(form.croppedAxisOf({ kind: 'full', fit: 'cover' }, portrait, 16 / 9)).toBe('x');
    expect(form.croppedAxisOf({ kind: 'full', fit: 'cover' }, 16 / 9, portrait)).toBe('y');
    expect(form.croppedAxisOf({ kind: 'full', fit: 'contain' }, portrait, 16 / 9)).toBeNull();
    expect(form.croppedAxisOf({ kind: 'full', fit: 'cover' }, portrait, portrait)).toBeNull();
    expect(form.croppedAxisOf(inset({ aspectRatio: null }), portrait, 16 / 9)).toBeNull();
  });

  it('reads the shape of a split\'s part off the frame, the share it takes and its padding', () => {
    const split = { kind: 'split', assetSide: 'start', assetRatio: 0.5, padding: 0, cornerRadius: 0, fit: 'cover' } as const;

    // Half of a 9:16 frame, down: 9 wide by 8 tall.
    expect(form.boxAspectRatioOf(split, 9 / 16, 1)).toBeCloseTo(9 / 8, 6);
    // Half of a 16:9 frame, across: 8 wide by 9 tall.
    expect(form.boxAspectRatioOf(split, 16 / 9, 1)).toBeCloseTo(8 / 9, 6);
    expect(form.boxAspectRatioOf({ ...split, padding: 0.1 }, 1, 1)).toBeCloseTo(0.8 / 0.3, 6);
  });

  it('keeps how the file fills its box across a switch of layout', () => {
    expect(form.withLayout({ kind: 'full', fit: 'contain', backdrop: 'blur' }, 'split')).toMatchObject({ kind: 'split', fit: 'contain', backdrop: 'blur' });
    expect(form.withLayout({ kind: 'full', fit: 'cover', position: { x: 0, y: 0.5 } }, 'inset')).toMatchObject({ kind: 'inset', position: { x: 0, y: 0.5 } });
  });

  it('drops the crop on a switch to fitting the file, and what fills the box on a switch to filling it', () => {
    expect(form.withoutCrop({ kind: 'full', fit: 'cover', position: { x: 0, y: 0 } })).toEqual({ kind: 'full', fit: 'cover' });
    expect(form.withoutBackdrop({ kind: 'full', fit: 'contain', backdrop: 'blur' })).toEqual({ kind: 'full', fit: 'contain' });
  });
});
