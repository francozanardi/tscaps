import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicPresetAnimation } from '@core/graphics/domain/GraphicPresetMotion';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';

/**
 * A graphic layer's style once `preset` is put on it: its entrance and its
 * exit made the ones the preset recommends, with the values it sets (kept
 * within what each field allows, a field the animation does not offer
 * dropped) and their own defaults for the rest, or none where it
 * recommends none, whatever was picked before. An animation the library
 * does not hold reads as none. A block written over by hand in the
 * layer's CSS is left alone, as the Motion tab leaves it.
 */
export class ShotGraphicPresetMotion {
  constructor(
    private readonly catalog: ElementAnimationCatalog,
    private readonly writer: ElementAnimationCssWriter,
  ) {}

  /** `styles` with the layer `layerId`'s entrance and exit made `preset`'s. */
  stylesFor(styles: ElementStyles, layerId: string, preset: GraphicPreset): ElementStyles {
    const entered = this.withScope(styles, layerId, ElementAnimationScope.ENTRANCE, preset.motion.entrance);
    return this.withScope(entered, layerId, ElementAnimationScope.EXIT, preset.motion.exit);
  }

  private withScope(
    styles: ElementStyles,
    layerId: string,
    scope: ElementAnimationScope.ENTRANCE | ElementAnimationScope.EXIT,
    recommended: GraphicPresetAnimation | null,
  ): ElementStyles {
    const css = styles.get(layerId)?.css ?? '';
    const current = styles.get(layerId)?.animations?.[scope];
    if (current !== undefined && this.writer.isTakenOver(css, 'layer', scope, current)) return styles;
    const next = this.animationOf(recommended);
    if (JSON.stringify(next) === JSON.stringify(current)) return styles;
    return styles.withAnimation(layerId, 'layer', scope, next, this.writer.rewrite(css, 'layer', scope, current, next));
  }

  private animationOf(recommended: GraphicPresetAnimation | null): ElementAnimation | undefined {
    const preset = recommended === null ? null : this.catalog.byId(recommended.presetId);
    if (recommended === null || preset === null) return undefined;
    const params: Record<string, ElementControlValue> = {};
    for (const control of preset.controls) {
      const value = recommended.params[control.id];
      if (value === undefined || typeof value !== typeof control.defaultValue) continue;
      params[control.id] = typeof value === 'number' ? Math.min(control.max ?? value, Math.max(control.min ?? value, value)) : value;
    }
    return { presetId: recommended.presetId, params };
  }
}
