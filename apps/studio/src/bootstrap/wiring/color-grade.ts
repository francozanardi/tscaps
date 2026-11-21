import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';
import { ColorGradeTelemetryReporter } from '@core/color-grade/services/ColorGradeTelemetryReporter';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { SetColorGradeAction } from '@core/color-grade/actions/SetColorGradeAction';
import { ColorGradeLooks } from '@core/color-grade/domain/ColorGradeLook';

export interface ColorGradeDependencies {
  readonly store: EditorStore;
  readonly telemetry: Telemetry;
}

export type ColorGradeModule = ReturnType<typeof bootColorGrade>;

/** Boots the colour grade: the looks offered and the action that grades the picture. */
export function bootColorGrade(deps: ColorGradeDependencies) {
  const looks = new ColorGradeLooks();
  return {
    looks,
    actions: {
      set: new SetColorGradeAction(deps.store, new ColorGradeTelemetryReporter(deps.telemetry, new TelemetryBudget(deps.store), looks)),
    },
  };
}
