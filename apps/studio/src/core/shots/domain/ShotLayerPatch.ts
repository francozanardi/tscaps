import type {
  FullShotLayerPlacement,
  InsetShotLayerPlacement,
  ShotLayerPlacementKind,
  SplitShotLayerPlacement,
} from '@core/shots/domain/ShotLayerPlacement';

/** Every setting any layout holds, by the name the placement stores it under. */
export type ShotLayerPlacementSettings =
  & Omit<FullShotLayerPlacement, 'kind'>
  & Omit<SplitShotLayerPlacement, 'kind'>
  & Omit<InsetShotLayerPlacement, 'kind'>;

/**
 * The part of a placement that changes, and nothing else. `layout`
 * switches the layout, starting it from its fresh settings and keeping
 * how the asset fills its box; a layer already in it keeps its own.
 * Each of `settings` then reaches a layer whose layout holds that
 * setting, and no other.
 */
export interface ShotLayerPlacementPatch {
  readonly layout?: ShotLayerPlacementKind;
  readonly settings?: Readonly<Partial<ShotLayerPlacementSettings>>;
}

/**
 * The part of a layer's stretch that changes. `outSec: null` plays to
 * the file's own end.
 */
export interface ShotLayerTimingPatch {
  readonly inSec?: number;
  readonly outSec?: number | null;
  readonly loop?: boolean;
}

/**
 * What changes on every layer it is given to: only the fields it names,
 * each section on its own, so layers that differ elsewhere keep their
 * differences. A section a layer has no use for — a stretch, on a still
 * picture — leaves it as it is.
 */
export interface ShotLayerPatch {
  readonly placement?: ShotLayerPlacementPatch;
  readonly timing?: ShotLayerTimingPatch;
}
