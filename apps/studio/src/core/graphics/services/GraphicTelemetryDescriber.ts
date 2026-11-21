import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicPresetCatalog } from '@core/graphics/domain/GraphicPresetCatalog';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';

/**
 * Says which preset a graphic came from in terms safe to report. A preset
 * we ship is named by its id; one the user saved is only `saved`, since
 * its id and its name are theirs; a graphic that started from none is
 * `custom`.
 */
export class GraphicTelemetryDescriber {
  constructor(
    private readonly shipped: GraphicPresetCatalog,
    private readonly library: GraphicPresetCatalog,
  ) {}

  /** The preset `graphic` started from, its code edited or not: a shipped id, `saved` or `custom`. */
  presetOf(graphic: Graphic): string {
    const origin = this.library.originOf(graphic);
    if (origin === null) return 'custom';
    return this.isShipped(origin.id) ? origin.id : 'saved';
  }

  /** `preset` as it can be reported: its id where it is one we ship, `saved` where it is the user's own. */
  nameOf(preset: GraphicPreset): string {
    return this.isShipped(preset.id) ? preset.id : 'saved';
  }

  /** The family `preset` is offered in: a shipped preset's own (`none` where it has none), `saved` for the user's own. */
  categoryOf(preset: GraphicPreset): string {
    return this.isShipped(preset.id) ? preset.category ?? 'none' : 'saved';
  }

  /** Whether `graphic` started from a preset and its code no longer is that preset's. */
  isCodeEdited(graphic: Graphic): boolean {
    return this.library.originOf(graphic) !== null && this.library.presetOf(graphic) === null;
  }

  private isShipped(presetId: string): boolean {
    return this.shipped.list().some((preset) => preset.id === presetId);
  }
}
