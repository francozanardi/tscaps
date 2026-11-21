import { describe, expect, it } from 'vitest';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { ShotLayerMotionForm } from '@presentation/shots/services/ShotLayerMotionForm';

const form = new ShotLayerMotionForm(new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS), new ElementTimingVariableResolver());

const slide = (duration: number, direction: string): ElementAnimation => ({ presetId: 'layer-slide-entrance', params: { duration, direction } });

describe('ShotLayerMotionForm', () => {
  it('offers the eight layer motions at each end, and no caption entrance', () => {
    const labels = (scope: ElementAnimationScope.ENTRANCE | ElementAnimationScope.EXIT) =>
      form.presets(scope).map((preset) => form.labelOf(preset));

    expect(labels(ElementAnimationScope.ENTRANCE)).toEqual(['Fade', 'Pop', 'Slide', 'Push', 'Zoom out', 'Blur', 'Wipe', 'Spin']);
    expect(labels(ElementAnimationScope.EXIT)).toEqual(['Fade', 'Pop', 'Slide', 'Push', 'Zoom out', 'Blur', 'Wipe', 'Spin']);
    expect(form.presets(ElementAnimationScope.EXIT).every((preset) => preset.id.endsWith('-exit'))).toBe(true);
  });

  it('reads an animation naming a preset that is gone as none, with no fields', () => {
    const gone = { presetId: 'layer-teleport-entrance', params: { duration: 1 } };

    expect(form.pickedPresetId(gone)).toBeNull();
    expect(form.fieldsOf(gone)).toEqual([]);
  });

  it('shows the picked preset\'s fields in its order, each at what it holds or ships, a fraction as a percentage', () => {
    const pushed = { presetId: 'layer-push-entrance', params: { distance: 0.75 } };

    expect(form.fieldsOf(pushed).map((view) => [view.control.id, view.kind === 'number' ? view.shown : view.value])).toEqual([
      ['duration', 0.45],
      ['direction', '0deg'],
      ['distance', 75],
    ]);
  });

  it('records a percentage shown as the fraction it reads', () => {
    const [, , distance] = form.fieldsOf({ presetId: 'layer-push-entrance', params: {} });

    expect(distance?.kind === 'number' ? form.recordedValue(distance, 35) : null).toBe(0.35);
  });

  it('says several layers differ when they play different presets, or none and one', () => {
    expect(form.isPresetMixed([slide(0.5, '270deg'), slide(1, '180deg')])).toBe(false);
    expect(form.isPresetMixed([slide(0.5, '270deg'), { presetId: 'layer-wipe-entrance', params: {} }])).toBe(true);
    expect(form.isPresetMixed([undefined, slide(0.5, '270deg')])).toBe(true);
  });

  it('marks a field mixed where another layer\'s preset holds it with another value, whatever its preset', () => {
    const wipeDown = { presetId: 'layer-wipe-entrance', params: { duration: 0.5, direction: '90deg' } };

    expect([...form.mixedFieldIds([slide(0.5, '270deg'), slide(1, '270deg'), undefined])]).toEqual(['duration']);
    expect([...form.mixedFieldIds([slide(0.5, '270deg'), wipeDown])]).toEqual(['direction']);
    expect([...form.mixedFieldIds([slide(0.5, '270deg'), { presetId: 'layer-fade-entrance', params: { duration: 0.5 } }])]).toEqual([]);
  });

  it('says under a graphic\'s motion that its own animation plays whatever is picked, and nothing under any other layer\'s', () => {
    const graphic = { id: 'g', graphic: { document: { html: '', css: '', js: '' }, fields: [], params: {}, aspectRatio: 3, moments: [], presetId: null, hidesCaptions: false } };
    const file = { id: 'f', mediaId: 'clip', inSec: 0, outSec: null, loop: false };

    expect(form.ownMotionNoteOf([graphic])).toBe('The graphic’s own animation always plays. This moves the whole box on top of it.');
    expect(form.ownMotionNoteOf([file])).toBeNull();
    expect(form.ownMotionNoteOf([graphic, file])).toBeNull();
  });
});
