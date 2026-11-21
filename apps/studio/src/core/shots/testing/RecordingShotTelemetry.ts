import type { TelemetryEventProperties } from '@shared/telemetry';
import { ErrorNameTelemetryDescriber } from '@core/errors/services/ErrorNameTelemetryDescriber';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
import type { GraphicPresetCatalog } from '@core/graphics/domain/GraphicPresetCatalog';
import { GraphicTelemetryDescriber } from '@core/graphics/services/GraphicTelemetryDescriber';
import { ShotEditTelemetryReporter } from '@core/shots/services/ShotEditTelemetryReporter';
import { ShotGraphicTelemetryReporter } from '@core/shots/services/ShotGraphicTelemetryReporter';
import { ShotLayerLayoutChangeReader } from '@core/shots/services/ShotLayerLayoutChangeReader';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';

/** One event as it was captured. */
export interface RecordedShotEvent {
  readonly name: TelemetryEventName;
  readonly properties: TelemetryEventProperties;
}

/**
 * The shots' telemetry reporters over a telemetry that keeps what it is
 * given, for tests: `events` is what was sent, in order. One budget for
 * both, as the app wires them; `library` names the presets a graphic can
 * come from, the shipped ones where none is given.
 */
export class RecordingShotTelemetry {
  readonly events: RecordedShotEvent[] = [];
  readonly edits: ShotEditTelemetryReporter;
  readonly graphics: ShotGraphicTelemetryReporter;
  readonly layoutChanges = new ShotLayerLayoutChangeReader();

  constructor(library: GraphicPresetCatalog = new BuiltinGraphicPresetCatalog()) {
    const telemetry = { capture: (name: TelemetryEventName, properties?: TelemetryEventProperties) => { this.events.push({ name, properties: properties ?? {} }); } };
    const budget = new TelemetryBudget({ historyGroupAuthor: null });
    this.edits = new ShotEditTelemetryReporter(telemetry, budget, new ErrorNameTelemetryDescriber());
    this.graphics = new ShotGraphicTelemetryReporter(telemetry, budget, new GraphicTelemetryDescriber(new BuiltinGraphicPresetCatalog(), library));
  }

  /** The properties of every event called `name`, in the order they were sent. */
  propertiesOf(name: TelemetryEventName): TelemetryEventProperties[] {
    return this.events.filter((event) => event.name === name).map((event) => event.properties);
  }
}
