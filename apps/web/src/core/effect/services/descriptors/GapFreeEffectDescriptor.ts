import { GapFreeEffect, type Effect } from '@tscaps/engine';
import type { EffectBuildContext, EffectDescriptor } from '@core/effect/domain/EffectDescriptor';
import type { GapFreeEffectConfig } from '@core/effect/domain/EffectConfig';

export class GapFreeEffectDescriptor implements EffectDescriptor<GapFreeEffectConfig> {
  readonly type = 'gap_free' as const;

  readonly defaultConfig: GapFreeEffectConfig = {
    type: 'gap_free',
    enabled: false,
  };

  build(_config: GapFreeEffectConfig, ctx: EffectBuildContext): Effect {
    return new GapFreeEffect(ctx.segmentFilter, undefined, ctx.videoDurationSeconds);
  }
}
