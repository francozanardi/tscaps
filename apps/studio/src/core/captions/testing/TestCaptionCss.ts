import { CssBlockSealer, CssFragmentParser, CssKeyframeNamespacer, CssMinifier } from '@tscaps/engine/advanced';
import { LayeredCaptionCssBuilder } from '@core/captions/services/LayeredCaptionCssBuilder';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { CssKeyframesLifter } from '@core/elements/services/css/CssKeyframesLifter';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementCssLayerBuilder } from '@core/elements/services/css/ElementCssLayerBuilder';
import { LineTypographyRereads } from '@core/elements/services/css/LineTypographyRereads';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';

/**
 * A caption's stylesheet assembled the way the app assembles it, for
 * tests that paint one: the built animation library, and every builder
 * between an animation's record and the layered CSS, as the rendering
 * wiring composes them.
 */
export class TestCaptionCss {
  readonly animationCatalog = new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS);

  readonly animationCssBuilder = new ElementAnimationCssBuilder(
    this.animationCatalog,
    new ElementTimingVariableResolver(),
    new ElementControlCssWriter(new CssFragmentParser(new CssMinifier())),
  );

  readonly animationCssWriter = new ElementAnimationCssWriter(this.animationCssBuilder);

  readonly layeredCaptionCssBuilder = new LayeredCaptionCssBuilder(
    new CssKeyframeNamespacer(),
    new CssMinifier(),
    new CssBlockSealer(),
    new CssKeyframesLifter(),
    new ElementCssLayerBuilder(new CssKeyframeNamespacer(), new CssMinifier(), new CssBlockSealer(), new CssKeyframesLifter(), new LineTypographyRereads()),
  );
}
