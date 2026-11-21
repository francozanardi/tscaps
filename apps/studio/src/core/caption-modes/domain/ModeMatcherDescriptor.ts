import type { ModeMatcher } from '@core/caption-modes/domain/ModeMatcher';
import type { ModeMatcherConfig } from '@core/caption-modes/domain/ModeMatcherConfig';

/** One kind of mode matcher: its `type` discriminator and how to build the matcher a config names. */
export interface ModeMatcherDescriptor {
  readonly type: string;
  /** The matcher `config` names. Throws, saying what is wrong, when `config` is malformed. */
  build(config: ModeMatcherConfig): ModeMatcher;
}
