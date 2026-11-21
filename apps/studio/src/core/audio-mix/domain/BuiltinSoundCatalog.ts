import type { BuiltinSound } from '@core/audio-mix/domain/BuiltinSound';

/**
 * The sounds bundled with the app: what a clip's `builtin` source
 * resolves against. Bundled sounds are not media files of the user's: no
 * upload, no quota, the same on every surface.
 */
export interface BuiltinSoundCatalog {
  /** Every sound, grouped by category in the order categories are offered, each group in pack order. */
  list(): readonly BuiltinSound[];
  /**
   * The sound under `soundId`, or null for one this build does not carry
   * (a project saved by a newer build, or a sound since withdrawn); a clip
   * naming it plays nothing.
   */
  find(soundId: string): BuiltinSound | null;
}
