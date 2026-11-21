import { BUILTIN_SOUND_PACK } from '@core/audio-mix/infrastructure/BuiltinSoundPack';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import { AudioMixTelemetryReporter } from '@core/audio-mix/services/AudioMixTelemetryReporter';
import { SuggestedSoundMatcher } from '@core/audio-mix/services/SuggestedSoundMatcher';
import { LayerTransitionSoundSuggestions } from '@core/shot-transitions/domain/LayerTransitionSoundSuggestions';
import { ShotTransitionSoundSuggestions } from '@core/shot-transitions/domain/ShotTransitionSoundSuggestions';
import { ShotCameraSounds } from '@core/shots/domain/ShotCameraSounds';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';
import type { TelemetryEventProperties } from '@shared/telemetry';

/** A soundtrack telemetry reporter for tests, wired as the editor wires it, keeping what it reports in `events`. */
export class TestAudioMixTelemetry {
  readonly events: Array<[TelemetryEventName, TelemetryEventProperties | undefined]> = [];
  readonly reporter = new AudioMixTelemetryReporter(
    { capture: (name, properties) => { this.events.push([name, properties]); } },
    new TelemetryBudget({ historyGroupAuthor: null }),
    new StaticFileBuiltinSoundCatalog(BUILTIN_SOUND_PACK, '/'),
    new SuggestedSoundMatcher(
      new ShotTransitionSoundSuggestions(),
      new ShotCameraSounds(),
      new LayerTransitionSoundSuggestions(),
      new ShotLayerSplitTransitions(),
      new ShotLayerInsetTransitions(),
    ),
  );

  /** The properties of each event of `name`, in the order they were reported. */
  propertiesOf(name: TelemetryEventName): Array<TelemetryEventProperties | undefined> {
    return this.events.filter(([event]) => event === name).map(([, properties]) => properties);
  }
}
