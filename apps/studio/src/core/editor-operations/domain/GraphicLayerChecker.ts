import type { GraphicCheckReport } from '@core/graphics/domain/GraphicCheckReport';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';

/**
 * Plays one graphic layer once, at its real box size, and reports what
 * its code did: errors, logged lines, empty pictures, and its pictures at
 * the times asked (seconds since the graphic appears, clamped to how long
 * it shows). The caller closes the report's bitmaps. Given `placement`,
 * the graphic is played in the box that layout would give it instead of
 * its own, the layer left as it is.
 */
export interface GraphicLayerChecker {
  check(layerId: string, times: ReadonlyArray<number>, signal: AbortSignal, placement?: ShotLayerPlacement): Promise<GraphicCheckReport>;
}
