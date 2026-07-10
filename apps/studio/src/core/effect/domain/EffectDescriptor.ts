import type { Effect, Segment } from '@tscaps/engine';
import type { EffectConfig } from '@core/effect/domain/EffectConfig';

/**
 * Runtime inputs the deriver supplies when materialising an Effect from a
 * config. `segmentFilter` is a predicate that scopes the Effect to a
 * subset of the document's segments — typically a single sheet's
 * sections. `videoDurationSeconds` is the current video's total duration
 * in seconds; effects that need a hard upper bound on segment timing
 * (e.g. extending the trailing segment) read it here.
 */
export interface EffectBuildContext {
  readonly segmentFilter: (segment: Segment) => boolean;
  readonly videoDurationSeconds: number;
}

/**
 * Adapter between a persisted effect config and the engine `Effect` it
 * builds. Implementations are registered in `EffectRegistry`, which uses
 * `defaultConfig` to seed any effect a sheet hasn't persisted yet and
 * dispatches `build` polymorphically. Effects that ignore part of the
 * build context simply leave it unused.
 */
export interface EffectDescriptor<TConfig extends EffectConfig = EffectConfig> {
  readonly type: TConfig['type'];
  readonly defaultConfig: TConfig;
  build(config: TConfig, ctx: EffectBuildContext): Effect;
}
