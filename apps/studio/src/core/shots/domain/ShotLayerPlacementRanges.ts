/** The least and the most a placement setting may hold, both included. */
export interface ShotLayerPlacementRange {
  readonly min: number;
  readonly max: number;
}

/**
 * How far each placement setting may go. Past these a layout stops being
 * itself: a split whose asset takes nine tenths is a full screen with a
 * strip, an inset a tenth wide is not a picture anyone can read.
 *
 * Read by the sanitizer, which clamps every placement to them, and by
 * whatever offers the settings, so a control never reaches a value the
 * write would take back.
 */
export const SHOT_LAYER_PLACEMENT_RANGES = {
  splitAssetRatio: { min: 0.3, max: 0.7 },
  splitPadding: { min: 0, max: 0.1 },
  insetWidth: { min: 0.1, max: 1 },
  insetPadding: { min: 0, max: 0.2 },
  center: { min: 0, max: 1 },
  cornerRadius: { min: 0, max: 0.5 },
  aspectRatio: { min: 0.2, max: 5 },
} as const satisfies Record<string, ShotLayerPlacementRange>;
