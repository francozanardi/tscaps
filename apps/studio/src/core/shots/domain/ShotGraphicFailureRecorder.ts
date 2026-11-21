import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicFailureStage } from '@core/graphics/domain/GraphicFailureStage';

/** Keeps note of a graphic layer whose code broke. Never throws. */
export interface ShotGraphicFailureRecorder {
  /** The layer `layerId`, showing `graphic`, broke at `stage` with `error`. */
  record(layerId: string, graphic: Graphic, stage: GraphicFailureStage, error: unknown): void;
}
