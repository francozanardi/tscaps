import type { Effect } from '@tscaps/engine';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import type { EffectBuildContext, EffectDescriptor } from '@core/effect/domain/EffectDescriptor';
import { GapFreeEffectDescriptor } from '@core/effect/services/descriptors/GapFreeEffectDescriptor';
import { RemovePunctuationEffectDescriptor } from '@core/effect/services/descriptors/RemovePunctuationEffectDescriptor';
import { SmartPunctuationEffectDescriptor } from '@core/effect/services/descriptors/SmartPunctuationEffectDescriptor';
import { SmartLowercaseEffectDescriptor } from '@core/effect/services/descriptors/SmartLowercaseEffectDescriptor';
import { CarryQuotesEffectDescriptor } from '@core/effect/services/descriptors/CarryQuotesEffectDescriptor';
import { EmojiEffectDescriptor } from '@core/effect/services/descriptors/EmojiEffectDescriptor';

/**
 * Single source of truth for every effect the editor knows about. Mirrors
 * `SegmentSplitterRegistry`: descriptors are registered by type, the
 * registry serves their defaults to bootstrap a sheet's `effectConfigs`,
 * and `build` instantiates the underlying engine Effect from a config.
 *
 * Adding a new effect = registering its descriptor here; the deriver, the
 * StyleTab UI, and the persistence layer all pick it up automatically.
 */
export class EffectRegistry {
  private readonly _byType = new Map<string, EffectDescriptor>();

  constructor() {
    this.register(new GapFreeEffectDescriptor());
    this.register(new RemovePunctuationEffectDescriptor());
    this.register(new CarryQuotesEffectDescriptor());
    this.register(new SmartPunctuationEffectDescriptor());
    this.register(new SmartLowercaseEffectDescriptor());
    this.register(new EmojiEffectDescriptor());
  }

  get(type: EffectConfig['type']): EffectDescriptor {
    const descriptor = this._byType.get(type);
    if (!descriptor) throw new Error(`Unknown effect type: ${type}`);
    return descriptor;
  }

  // All registered descriptors, in registration order. Used by the
  // StyleTab to render one toggle per known effect — even effects the
  // current sheet doesn't yet have a config entry for.
  list(): EffectDescriptor[] {
    return [...this._byType.values()];
  }

  build(config: EffectConfig, ctx: EffectBuildContext): Effect {
    const descriptor = this.get(config.type) as EffectDescriptor<typeof config>;
    return descriptor.build(config, ctx);
  }

  // Returns one default config per registered effect. Used when bootstrapping
  // a Sheet so every effect appears in `effectConfigs` from day one (the
  // toggle UI then just flips `enabled`, no add/remove).
  defaults(): EffectConfig[] {
    return this.list().map((d) => d.defaultConfig);
  }

  private register(descriptor: EffectDescriptor): void {
    this._byType.set(descriptor.type, descriptor);
  }
}
