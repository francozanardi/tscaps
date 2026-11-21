import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicFailureStage } from '@core/graphics/domain/GraphicFailureStage';
import type { GraphicTelemetryDescriber } from '@core/graphics/services/GraphicTelemetryDescriber';
import type { ErrorNameTelemetryDescriber } from '@core/errors/services/ErrorNameTelemetryDescriber';
import type { ShotGraphicFailureRecorder } from '@core/shots/domain/ShotGraphicFailureRecorder';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

/**
 * Reports a graphic that broke as `graphic_failed`, once per layer and
 * stage for as long as the instance lives: a graphic that fails to draw
 * fails on every frame asked of it.
 *
 * Carries the names of the error and of its cause, never their messages:
 * what a graphic's code throws can quote that code, or the words the user
 * put in it. A shipped preset whose code nobody edited is the case that
 * is ours to fix, which is why the preset and `code_edited` travel along.
 */
export class TelemetryShotGraphicFailureRecorder implements ShotGraphicFailureRecorder {
  private readonly reported = new Set<string>();

  constructor(
    private readonly telemetry: Telemetry,
    private readonly graphics: GraphicTelemetryDescriber,
    private readonly errorNames: ErrorNameTelemetryDescriber,
  ) {}

  record(layerId: string, graphic: Graphic, stage: GraphicFailureStage, error: unknown): void {
    const key = `${layerId}:${stage}`;
    if (this.reported.has(key)) return;
    this.reported.add(key);
    this.telemetry.capture('graphic_failed', {
      stage,
      preset: this.graphics.presetOf(graphic),
      code_edited: this.graphics.isCodeEdited(graphic),
      ...this.errorNames.describe(error),
    });
  }
}
