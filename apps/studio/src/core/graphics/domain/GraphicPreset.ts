import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicBox } from '@core/graphics/domain/GraphicBox';
import type { GraphicPresetCategory } from '@core/graphics/domain/GraphicPresetCategory';
import type { GraphicPresetMotion } from '@core/graphics/domain/GraphicPresetMotion';
import type { GraphicPresetSound } from '@core/graphics/domain/GraphicPresetSound';

/**
 * A graphic to start from: what it is called, what it is for, the family
 * it is listed under (null for one a user saved), the graphic itself, the
 * box it is meant for, how its layer comes in and leaves, and the sounds
 * it brings.
 *
 * A preset a user saved also keeps its layer's whole style as they left
 * it (`style`): its layout, its motion of every kind, its camera and the
 * CSS written by hand. Put on a layer, that style stands in for `box` and
 * `motion`, which then only describe it. A shipped preset has none.
 */
export interface GraphicPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: GraphicPresetCategory | null;
  readonly graphic: Graphic;
  readonly box: GraphicBox;
  readonly motion: GraphicPresetMotion;
  readonly sounds: ReadonlyArray<GraphicPresetSound>;
  readonly style: ElementStyle | null;
}
