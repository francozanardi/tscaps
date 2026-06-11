import { SmartLowercaseEffect, type Effect } from '@tscaps/engine';
import type { EffectBuildContext, EffectDescriptor } from '@core/effect/domain/EffectDescriptor';
import type { SmartLowercaseEffectConfig } from '@core/effect/domain/EffectConfig';

export class SmartLowercaseEffectDescriptor implements EffectDescriptor<SmartLowercaseEffectConfig> {
  readonly type = 'smart_lowercase' as const;

  readonly defaultConfig: SmartLowercaseEffectConfig = {
    type: 'smart_lowercase',
    enabled: false,
  };

  build(_config: SmartLowercaseEffectConfig, ctx: EffectBuildContext): Effect {
    return new SmartLowercaseEffect(ctx.segmentFilter);
  }
}
