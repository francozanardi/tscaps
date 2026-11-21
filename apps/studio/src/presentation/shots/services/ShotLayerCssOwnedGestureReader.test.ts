import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { CssControlledFieldFinder } from '@core/elements/services/css/CssControlledFieldFinder';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { ShotLayerCssOwnedGestureReader } from '@presentation/shots/services/ShotLayerCssOwnedGestureReader';
import { ShotLayerTakeoverReader } from '@presentation/shots/services/ShotLayerTakeoverReader';

/**
 * Which preview gestures on a box a layer's own CSS has made pointless.
 * The promise: the move goes exactly when the panel dims *Position*, the
 * resize exactly when it dims *Size*, and a transform on top of the box
 * takes neither.
 */

const layouts = new TestShotLayerLayouts();
const takeover = new ShotLayerTakeoverReader(
  new CssControlledFieldFinder(layouts.controls),
  layouts.catalog.controlsFor('layer'),
  new ElementAnimationCssWriter(new ElementAnimationCssBuilder(
    new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS),
    new ElementTimingVariableResolver(),
    layouts.controls,
  )),
  new CssFragmentParser(new CssMinifier()),
);
const reader = new ShotLayerCssOwnedGestureReader(takeover);
const INSET: ShotLayerPlacement = {
  kind: 'inset', subject: 'asset', centerX: 0.3, centerY: 0.7, width: 0.4, aspectRatio: 1, padding: 0.04, cornerRadius: 0.04, fit: 'cover',
};

/** A box laid out by `INSET` as the panel writes it, with `byHand` typed after. */
function styled(byHand = '') {
  const style = layouts.writer.written(ElementStyles.empty(), 'box', INSET).get('box')!;
  return byHand === '' ? style : { ...style, css: `${style.css}\n${byHand}` };
}

const gestures = (byHand: string) => [...reader.read(styled(byHand))].sort();

describe('ShotLayerCssOwnedGestureReader', () => {
  it('leaves every gesture to a box the panel laid out, or one never styled', () => {
    expect(gestures('')).toEqual([]);
    expect(reader.read(null).size).toBe(0);
  });

  it('takes the move where the CSS places the box', () => {
    expect(gestures('left: 8cqw;')).toEqual(['move']);
    expect(gestures('bottom: 10cqh;')).toEqual(['move']);
    expect(gestures('inset: 4cqh auto auto 4cqw;')).toEqual(['move']);
    expect(gestures('--layer-center-y: .2;')).toEqual(['move']);
  });

  it('takes the resize where the CSS sizes the box', () => {
    expect(gestures('width: 30cqw;')).toEqual(['resize']);
    expect(gestures('height: 20cqh;')).toEqual(['resize']);
    expect(gestures('--layer-width: .7;')).toEqual(['resize']);
  });

  it('takes both where the CSS places and sizes the box', () => {
    expect(gestures('left: 8cqw; width: 30cqw;')).toEqual(['move', 'resize']);
  });

  it('takes neither for a transform, which moves the box the fields still place', () => {
    expect(gestures('translate: 4cqw 0; scale: 1.2; transform: rotate(4deg);')).toEqual([]);
  });

  it('answers what the panel dims, so the preview and the panel cannot disagree', () => {
    for (const byHand of ['left: 8cqw;', 'top: 3cqh;', 'width: 30cqw;', '--layer-aspect-ratio: 2;', 'object-fit: contain;']) {
      const taken = takeover.read(styled(byHand)).layoutFields;
      const owned = reader.read(styled(byHand));

      expect(owned.has('move')).toBe(taken.has('centerX') || taken.has('centerY'));
      expect(owned.has('resize')).toBe(taken.has('width'));
    }
  });
});
