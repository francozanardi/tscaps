import { RemovePunctuationEffect, type Effect } from '@tscaps/engine';
import type { EffectBuildContext, EffectDescriptor } from '@core/effect/domain/EffectDescriptor';
import type { RemovePunctuationEffectConfig } from '@core/effect/domain/EffectConfig';

export class RemovePunctuationEffectDescriptor implements EffectDescriptor<RemovePunctuationEffectConfig> {
  readonly type = 'remove_punctuation' as const;

  readonly defaultConfig: RemovePunctuationEffectConfig = {
    type: 'remove_punctuation',
    enabled: false,
  };

  build(_config: RemovePunctuationEffectConfig, ctx: EffectBuildContext): Effect {
    return new RemovePunctuationEffect(ctx.segmentFilter);
  }
}
