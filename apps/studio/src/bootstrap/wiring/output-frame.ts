import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';
import { OutputFrameTelemetryReporter } from '@core/output-frame/services/OutputFrameTelemetryReporter';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { SetOutputFrameAction } from '@core/output-frame/actions/SetOutputFrameAction';

export interface OutputFrameDependencies {
  readonly store: EditorStore;
  readonly refresh: RefreshDocumentAction;
  readonly telemetry: Telemetry;
}

export type OutputFrameModule = ReturnType<typeof bootOutputFrame>;

/**
 * Boots the output frame: the action that changes the shape the video
 * is exported and previewed in, and how the video sits in it.
 */
export function bootOutputFrame(deps: OutputFrameDependencies) {
  return {
    actions: {
      set: new SetOutputFrameAction(deps.store, deps.refresh, new OutputFrameTelemetryReporter(deps.telemetry, new TelemetryBudget(deps.store))),
    },
  };
}
