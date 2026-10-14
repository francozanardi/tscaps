import type { KeymapOverrides } from '@core/shortcuts/domain/KeymapOverrides';

/** Where the user's keymap choices are kept between visits. */
export interface KeymapOverridesRepository {
  /** The stored choices. Empty when there are none, or when what was stored cannot be read. */
  load(): KeymapOverrides;
  save(overrides: KeymapOverrides): void;
}
