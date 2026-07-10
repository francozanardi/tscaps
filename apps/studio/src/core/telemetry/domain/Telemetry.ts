import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import type { TelemetryEventProperties } from '@core/telemetry/domain/TelemetryEventProperties';

/**
 * Sends product-analytics events to the configured backend.
 *
 * Implementations are best-effort: a network error, a missing
 * environment variable, or a backend outage must never block the
 * caller — the contract is fire-and-forget. Implementations also
 * handle batching, retry, and identifier strategy internally.
 *
 * Event names live in a closed string-union to catch typos at
 * compile time. Properties are flat scalars; nested objects are
 * intentionally not supported because they make per-property
 * querying in the backend awkward.
 */
export interface Telemetry {
  capture(event: TelemetryEventName, properties?: TelemetryEventProperties): void;
}
