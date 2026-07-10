import { CssVariable } from '@tscaps/engine';
import type { EmojiEffectConfig } from '@core/effect/domain/EffectConfig';

/** Builds the per-sheet CSS variables that drive emoji decoration rendering: the font-size multiplier and the gap multiplier. */
export class EmojiCssVarBuilder {
  build(config: EmojiEffectConfig | null): Record<string, string> {
    if (!config) return {};
    return {
      [CssVariable.DECORATION_FONT_SIZE_MULTIPLIER]: String(config.size),
      [CssVariable.DECORATION_GAP_MULTIPLIER]: String(config.gap),
    };
  }
}
