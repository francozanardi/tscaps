import { SmartLowercaseEffect, type Effect } from '@tscaps/engine';
import type { EffectBuildContext, EffectDescriptor } from '@core/effect/domain/EffectDescriptor';
import type { SmartLowercaseEffectConfig } from '@core/effect/domain/EffectConfig';
import type { TagName } from '@core/tagging/domain/TagName';

const PRESERVED_TAG_NAMES: ReadonlyArray<TagName> = ['entity'];

export class SmartLowercaseEffectDescriptor implements EffectDescriptor<SmartLowercaseEffectConfig> {
  readonly type = 'smart_lowercase' as const;

  readonly defaultConfig: SmartLowercaseEffectConfig = {
    type: 'smart_lowercase',
    enabled: false,
  };

  build(_config: SmartLowercaseEffectConfig, ctx: EffectBuildContext): Effect {
    return new SmartLowercaseEffect(PRESERVED_TAG_NAMES, ctx.segmentFilter);
  }
}
