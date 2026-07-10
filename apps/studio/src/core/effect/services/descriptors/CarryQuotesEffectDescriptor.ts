import { CarryQuotesEffect, type Effect } from '@tscaps/engine';
import type { EffectBuildContext, EffectDescriptor } from '@core/effect/domain/EffectDescriptor';
import type { CarryQuotesEffectConfig } from '@core/effect/domain/EffectConfig';

export class CarryQuotesEffectDescriptor implements EffectDescriptor<CarryQuotesEffectConfig> {
  readonly type = 'carry_quotes' as const;

  readonly defaultConfig: CarryQuotesEffectConfig = {
    type: 'carry_quotes',
    enabled: false,
  };

  build(_config: CarryQuotesEffectConfig, ctx: EffectBuildContext): Effect {
    return new CarryQuotesEffect(ctx.segmentFilter);
  }
}
