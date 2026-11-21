import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';

/** The graphics a new one can start from, in the order they are offered. */
export interface GraphicPresetCatalog {
  list(): ReadonlyArray<GraphicPreset>;
  /** The one a new graphic starts as when none is picked. */
  starter(): GraphicPreset;
  /** The one a new graphic starts as on the video's first shot, where a hook is what it most likely is. */
  openingStarter(): GraphicPreset;
  /**
   * The preset `graphic` still is, its code unchanged — the one it started
   * from where several show that code; null once none does (a *Custom*
   * graphic).
   */
  presetOf(graphic: Graphic): GraphicPreset | null;
  /**
   * The preset `graphic` started from, its code edited or not, to go back
   * to; one stored before graphics kept it is known by its code while that
   * is still a preset's. Null where none can be named.
   */
  originOf(graphic: Graphic): GraphicPreset | null;
}
