import type { SingleTileFallback, SpriteSheetProbeObserver } from '@tscaps/engine/advanced';
import type { ErrorReporter } from '@core/errors/domain/ErrorReporter';
import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

const ORIGIN = 'sprite-sheet-probe';

/**
 * Announces that this device sized a caption sprite sheet down to a
 * single tile, so the export rasterizes once per frame.
 *
 * No notice is published: the export still finishes and the person at
 * the screen has no move to make.
 *
 * A refusal that threw goes to both channels — the event to count it
 * beside the ones that did not throw, the error report for the stack.
 */
export class SpriteSheetProbeReporter implements SpriteSheetProbeObserver {

  constructor(
    private readonly telemetry: Telemetry,
    private readonly errorReporter: ErrorReporter,
    private readonly errorClassifier: AppErrorClassifier,
    private readonly errorTelemetryDescriber: AppErrorTelemetryDescriber,
  ) {}

  onSingleTileFallback(fallback: SingleTileFallback): void {
    this.telemetry.capture('sprite_sheet_single_tile_fallback', {
      width: fallback.width,
      height: fallback.height,
      refused_tiles: fallback.refusedTiles,
      refusal: fallback.refusal,
      ...this.describeCause(fallback.cause),
    });
    if (fallback.cause === undefined) return;
    this.errorReporter.report(this.errorClassifier.wrap(fallback.cause), ORIGIN);
  }

  /** The error fields every other event carries, or none when nothing was thrown. */
  private describeCause(cause: unknown): Record<string, unknown> {
    if (cause === undefined) return {};
    return this.errorTelemetryDescriber.describe(this.errorClassifier.wrap(cause));
  }
}
