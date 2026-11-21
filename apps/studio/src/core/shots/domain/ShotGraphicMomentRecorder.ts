import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicMoment } from '@core/graphics/domain/GraphicMoment';

/** Keeps what a graphic layer's code declared about its moments. */
export interface ShotGraphicMomentRecorder {
  /**
   * The layer `layerId`, showing `graphic`, ran its code and declared
   * `moments`. Kept only while the layer still shows that graphic (the same
   * document and values), so what an older run said never overwrites a
   * newer one.
   */
  record(layerId: string, graphic: Graphic, moments: ReadonlyArray<GraphicMoment>): void;
}
