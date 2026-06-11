import { SmartPunctuationEffect, type Effect } from '@tscaps/engine';
import type { EffectBuildContext, EffectDescriptor } from '@core/effect/domain/EffectDescriptor';
import type { SmartPunctuationEffectConfig } from '@core/effect/domain/EffectConfig';

export class SmartPunctuationEffectDescriptor implements EffectDescriptor<SmartPunctuationEffectConfig> {
  readonly type = 'smart_punctuation' as const;

  readonly defaultConfig: SmartPunctuationEffectConfig = {
    type: 'smart_punctuation',
    enabled: false,
  };

  build(_config: SmartPunctuationEffectConfig, ctx: EffectBuildContext): Effect {
    return new SmartPunctuationEffect(ctx.segmentFilter);
  }
}
