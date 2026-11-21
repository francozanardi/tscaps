import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicTelemetryDescriber } from '@core/graphics/services/GraphicTelemetryDescriber';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import type { TelemetryEventProperties } from '@shared/telemetry';

// What one page load sends of each event at most: someone trying preset after preset would otherwise
// outweigh every other visitor.
const PER_EVENT_LIMIT = 30;

/**
 * Reports what is done with graphics on shots: one added, a preset put on
 * one, its code edited, and one kept as a preset of the user's own.
 *
 * A preset travels as its id where it is one we ship, and as `saved` or
 * `custom` otherwise: a saved preset's id and name are the user's. A
 * graphic's code and the words in it never travel. Each event is capped
 * per page load; an edit of the code is reported once per part, since
 * typing edits it on every key.
 */
export class ShotGraphicTelemetryReporter {
  constructor(
    private readonly telemetry: Telemetry,
    private readonly budget: TelemetryBudget,
    private readonly graphics: GraphicTelemetryDescriber,
  ) {}

  /** A graphic started as `preset` was added; `firstShot` where it went on the video's first shot. */
  graphicAdded(preset: GraphicPreset, firstShot: boolean): void {
    this.capture('shot_graphic_added', { preset: this.graphics.nameOf(preset), first_shot: firstShot });
  }

  /** `preset` was put on a graphic that was `previous` until then. */
  presetApplied(preset: GraphicPreset, previous: Graphic): void {
    this.capture('graphic_preset_applied', {
      preset: this.graphics.nameOf(preset),
      category: this.graphics.categoryOf(preset),
      previous_preset: this.graphics.presetOf(previous),
    });
  }

  /** The `part` of a graphic's code (`html`, `css` or `js`) was changed. */
  codeEdited(part: string): void {
    if (!this.budget.allows(`graphic_code_edited:${part}`, 1)) return;
    this.capture('graphic_code_edited', { part });
  }

  /** `graphic` was kept as a new preset of the user's own, or written over the one it was made from. */
  presetSaved(mode: 'create' | 'overwrite', graphic: Graphic): void {
    this.capture('graphic_preset_saved', { mode, from_preset: this.graphics.presetOf(graphic) });
  }

  private capture(event: TelemetryEventName, properties: TelemetryEventProperties): void {
    if (!this.budget.allows(event, PER_EVENT_LIMIT)) return;
    this.telemetry.capture(event, properties);
  }
}
