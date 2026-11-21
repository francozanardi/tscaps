import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { CssControlledFieldFinder } from '@core/elements/services/css/CssControlledFieldFinder';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { ShotLayerTakeoverReader } from '@presentation/shots/services/ShotLayerTakeoverReader';

/**
 * Which of a layer's panel fields its own CSS has taken over. The promise:
 * what the panels wrote is never reported, and CSS written by hand over a
 * field — its own declaration, or one deciding what it would — is.
 */

const layouts = new TestShotLayerLayouts();
const motions = new ElementAnimationCssWriter(new ElementAnimationCssBuilder(
  new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS),
  new ElementTimingVariableResolver(),
  layouts.controls,
));
const reader = new ShotLayerTakeoverReader(
  new CssControlledFieldFinder(layouts.controls),
  layouts.catalog.controlsFor('layer'),
  motions,
  new CssFragmentParser(new CssMinifier()),
);
const ENTRANCE = ElementAnimationScope.ENTRANCE;
const EXIT = ElementAnimationScope.EXIT;
const INSET: ShotLayerPlacement = {
  kind: 'inset', subject: 'asset', centerX: 0.3, centerY: 0.7, width: 0.4, aspectRatio: 1, padding: 0.04, cornerRadius: 0.04, fit: 'cover',
};
const FADE_IN = { presetId: 'layer-fade-entrance', params: {} };
const SLIDE_OUT = { presetId: 'layer-slide-exit', params: {} };

/** A layer laid out by `INSET` and moving in and out, as the panels write it, with `byHand` typed after. */
function styled(byHand = '') {
  let styles = layouts.writer.written(ElementStyles.empty(), 'clip', INSET);
  for (const [scope, animation] of [[ENTRANCE, FADE_IN], [EXIT, SLIDE_OUT]] as const) {
    const css = motions.rewrite(styles.get('clip')!.css, 'layer', scope, undefined, animation);
    styles = styles.withAnimation('clip', 'layer', scope, animation, css);
  }
  const style = styles.get('clip')!;
  return byHand === '' ? style : { ...style, css: `${style.css}\n${byHand}` };
}

describe('ShotLayerTakeoverReader', () => {
  it('reports nothing of what the panels wrote, or of a layer never styled', () => {
    expect(reader.read(styled())).toEqual({ layoutFields: new Set(), motion: new Set(), cameraPosition: false });
    expect(reader.read(null)).toEqual({ layoutFields: new Set(), motion: new Set(), cameraPosition: false });
  });

  it('reports a field whose own declaration was written over', () => {
    expect([...reader.read(styled('--layer-width: .7; object-fit: contain;')).layoutFields].sort()).toEqual(['fit', 'width']);
  });

  it('reports the position and the size under a box placed or sized by hand', () => {
    expect([...reader.read(styled('left: 10px;')).layoutFields].sort()).toEqual(['assetSide', 'centerX']);
    expect([...reader.read(styled('height: 30cqh;')).layoutFields].sort()).toEqual(['aspectRatio', 'assetRatio', 'width']);
  });

  it('reports an end whose block was written over, and leaves the other', () => {
    const edited = styled().css.replace('--layer-entrance-duration:', '--layer-entrance-duration: 2s; --was:');

    expect([...reader.read({ ...styled(), css: edited }).motion]).toEqual([ENTRANCE]);
  });

  it('reports both ends and the camera under an animation of the layer\'s own, which replaces what plays them', () => {
    expect([...reader.read(styled('animation: spin 1s var(--on-layer-starts) both;')).motion].sort())
      .toEqual([ENTRANCE, EXIT, ElementAnimationScope.CAMERA].sort());
  });

  it('reports the camera\'s position where the CSS says where it looks, by hand or over its field', () => {
    expect(reader.read(styled('--layer-picture-x: 0.2;')).cameraPosition).toBe(true);
    const placed = { ...styled(), fields: { ...styled().fields, [ElementFieldId.PICTURE_X]: 0.4 }, css: `${styled().css}\n--layer-picture-x: 0.4;` };
    expect(reader.read(placed).cameraPosition).toBe(false);
    expect(reader.read({ ...placed, css: `${placed.css}\n--layer-picture-x: 0.9;` }).cameraPosition).toBe(true);
  });

  it('leaves the panels alone for what a keyframe moves, which comes back to rest', () => {
    expect(reader.read(styled('@keyframes drift { to { left: 20px; } }')).layoutFields.size).toBe(0);
  });
});
