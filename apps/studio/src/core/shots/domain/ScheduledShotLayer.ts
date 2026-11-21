import type { FileFootageSource } from '@tscaps/engine';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotLayerStretch } from '@core/shots/domain/ShotLayerStretch';

/** What a layer needs to know of what it shows to be laid out: a file of one of the engine's kinds, or a graphic. */
export interface ShotLayerAsset {
  readonly kind: FileFootageSource['kind'] | 'graphic';
  /** How long the asset runs, or null when unknown (or still). */
  readonly durationSec: number | null;
  /** The asset's width over its height, or null when unknown. */
  readonly aspectRatio: number | null;
}

interface ScheduledShotLayerBase {
  readonly layer: ShotLayer;
  readonly stretch: ShotLayerStretch;
}

/** A scheduled layer whose file the catalog holds, so what it is is known. */
export interface ScheduledListedShotLayer extends ScheduledShotLayerBase {
  readonly asset: ShotLayerAsset;
}

/**
 * A scheduled layer whose file the catalog does not hold — deleted
 * elsewhere, or not listed yet. What it is cannot be known, so nothing
 * draws it: it spans its shot and the video shows there.
 */
export interface ScheduledUnlistedShotLayer extends ScheduledShotLayerBase {
  readonly asset: null;
}

/**
 * A layer that reaches the output: where it shows on the output
 * timeline, and what is known of its asset.
 */
export type ScheduledShotLayer = ScheduledListedShotLayer | ScheduledUnlistedShotLayer;
