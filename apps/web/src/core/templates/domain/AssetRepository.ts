import type { Asset } from '@core/templates/domain/Asset';

/**
 * Read-only registry of assets a template can paint with. Resolution
 * is uniform across origins (built-in vs user-uploaded): `resolve(id)`
 * returns the same shape regardless of where the bytes live.
 *
 * Reads are synchronous: implementations are expected to project over
 * data already resident in memory and to never touch IO.
 */
export interface AssetRepository {
  /** Every entry currently known, in implementation-defined order. */
  list(): readonly Asset[];

  /** The entry registered under `id`, or `null` when no such entry exists. */
  resolve(id: string): Asset | null;
}
