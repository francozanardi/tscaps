import type { Effect } from '@tscaps/engine';
import type { EffectBuildContext, EffectDescriptor } from '@core/effect/domain/EffectDescriptor';
import type { EmojiEffectConfig } from '@core/effect/domain/EffectConfig';
import { EMOJI_PLACEMENT_DEFAULT, EMOJI_SIZE_DEFAULT, EMOJI_GAP_DEFAULT } from '@core/effect/domain/EffectConfig';
import { PassthroughEffect } from '@core/effect/services/PassthroughEffect';

/**
 * Descriptor for the AI-emoji feature. The persisted shape carries an
 * `enabled` toggle and a `placement` mode; the actual rendering of the
 * glyphs happens in the subtitle renderer based on those fields. The
 * built `Effect` is a no-op because the document itself is not
 * transformed.
 */
export class EmojiEffectDescriptor implements EffectDescriptor<EmojiEffectConfig> {
  readonly type = 'emoji' as const;

  readonly defaultConfig: EmojiEffectConfig = {
    type: 'emoji',
    enabled: false,
    placement: EMOJI_PLACEMENT_DEFAULT,
    size: EMOJI_SIZE_DEFAULT,
    gap: EMOJI_GAP_DEFAULT,
  };

  build(_config: EmojiEffectConfig, _ctx: EffectBuildContext): Effect {
    return new PassthroughEffect();
  }
}
