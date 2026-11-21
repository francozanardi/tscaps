import type { TelemetryEventProperties } from '@shared/telemetry';

/**
 * Describes a failure by the names of the error and of its cause, and the
 * HTTP status where a request was refused, leaving every message out.
 *
 * For failures whose messages can carry what the user put in: a file's
 * name, or the words a graphic's code was given. The names still group
 * the failures the way the full description does.
 */
export class ErrorNameTelemetryDescriber {
  describe(error: unknown): TelemetryEventProperties {
    const cause = error instanceof Error ? error.cause : null;
    return {
      error_name: this.nameOf(error),
      error_cause_name: this.nameOf(cause),
      http_status: this.statusOf(error) ?? this.statusOf(cause),
    };
  }

  private nameOf(error: unknown): string | null {
    return error instanceof Error ? error.name : null;
  }

  private statusOf(error: unknown): number | null {
    if (!(error instanceof Error)) return null;
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : null;
  }
}
