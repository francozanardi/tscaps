import type { Telemetry } from '@core/telemetry/domain/Telemetry';

/**
 * Telemetry adapter that drops every event on the floor. Used when no
 * telemetry backend is configured, so the dependency graph keeps the
 * same shape without conditional branches at the call site.
 */
export class NoopTelemetry implements Telemetry {

  capture(): void {}
}
