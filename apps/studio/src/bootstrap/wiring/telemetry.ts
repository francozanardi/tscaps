import type { UserAgentInspector } from '@core/_shared/infrastructure/UserAgentInspector';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { NoopTelemetry } from '@core/telemetry/infrastructure/NoopTelemetry';

export interface TelemetryDependencies {
  readonly userAgentInspector: UserAgentInspector;
  readonly appVersion: string;
}

export interface TelemetryModule {
  readonly telemetry: Telemetry;
}


/**
 * Boots the telemetry feature. Returns a no-op adapter by default so the
 * rest of the app keeps the same dependency graph and never branches on
 * "is telemetry on?" at the call site.
 */
export function bootTelemetry(_deps: TelemetryDependencies): TelemetryModule {
  return { telemetry: new NoopTelemetry() };
}
