import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicPresetCatalog } from '@core/graphics/domain/GraphicPresetCatalog';
import type { GraphicPresetMatcher } from '@core/graphics/services/GraphicPresetMatcher';
import type { SavedGraphicPresetStore } from '@core/graphics/store/SavedGraphicPresetStore';

/**
 * Every preset the user can start a graphic from: the ones they saved, the
 * most recent first, then the ones shipped. Read live, so a preset saved,
 * renamed or deleted counts at once. A new graphic starts as the shipped
 * starters.
 */
export class LibraryGraphicPresetCatalog implements GraphicPresetCatalog {
  constructor(
    private readonly builtins: GraphicPresetCatalog,
    private readonly saved: SavedGraphicPresetStore,
    private readonly matcher: GraphicPresetMatcher,
  ) {}

  list(): ReadonlyArray<GraphicPreset> {
    return [...this.saved.snapshot(), ...this.builtins.list()];
  }

  starter(): GraphicPreset {
    return this.builtins.starter();
  }

  openingStarter(): GraphicPreset {
    return this.builtins.openingStarter();
  }

  presetOf(graphic: Graphic): GraphicPreset | null {
    return this.matcher.presetOf(this.list(), graphic);
  }

  originOf(graphic: Graphic): GraphicPreset | null {
    return this.matcher.originOf(this.list(), graphic);
  }
}
