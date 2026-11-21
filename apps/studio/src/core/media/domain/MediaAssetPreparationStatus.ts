/**
 * Where one asset stands on its way to being usable in the editor.
 *
 * - `preparing`: what it is previewed through is being made.
 * - `ready`: a shot may use it.
 * - `failed`: it could not be made ready; trying again may.
 * - `missing`: neither its preview nor the file itself can be had here.
 * - `unplayable`: the file is here, but this browser cannot play it (a
 *   GIF no decoder here can read); trying again in this browser will
 *   not change that.
 */
export type MediaAssetPreparationPhase = 'preparing' | 'ready' | 'failed' | 'missing' | 'unplayable';

export interface MediaAssetPreparationStatus {
  readonly phase: MediaAssetPreparationPhase;
  /** The fraction made, while preparing; null otherwise. */
  readonly progress: number | null;
  /** Why it could not be made, for `failed`; why it cannot play, for `unplayable`. */
  readonly error: unknown;
}
