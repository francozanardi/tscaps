import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';

/**
 * Which of a list of presets a graphic is, or came from. A graphic is a
 * preset while it shows that preset's code; where several show the same
 * code (a preset saved without changing it), the one it started from wins.
 */
export class GraphicPresetMatcher {
  /** The preset `graphic` still is, its code unchanged; null once no preset shows its code. */
  presetOf(presets: ReadonlyArray<GraphicPreset>, graphic: Graphic): GraphicPreset | null {
    const document = JSON.stringify(graphic.document);
    const showsIt = (preset: GraphicPreset) => JSON.stringify(preset.graphic.document) === document;
    return presets.find((preset) => preset.id === graphic.presetId && showsIt(preset)) ?? presets.find(showsIt) ?? null;
  }

  /** The preset `graphic` started from, by the id it keeps, or else the one it still is; null where neither is listed. */
  originOf(presets: ReadonlyArray<GraphicPreset>, graphic: Graphic): GraphicPreset | null {
    return presets.find((preset) => preset.id === graphic.presetId) ?? this.presetOf(presets, graphic);
  }
}
