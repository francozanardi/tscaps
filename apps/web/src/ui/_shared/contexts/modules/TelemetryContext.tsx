import { createContext, useContext, type ReactNode } from 'react';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

const TelemetryContext = createContext<TelemetryModule | null>(null);

interface TelemetryProviderProps {
  value: TelemetryModule;
  children: ReactNode;
}

export function TelemetryProvider({ value, children }: TelemetryProviderProps) {
  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

/**
 * Returns the telemetry adapter for the current tree. Throws if the
 * consumer is mounted outside `<TelemetryProvider>`; that is always
 * a wiring bug and should surface loudly rather than silently drop
 * events the rest of the codebase assumes are being captured.
 */
export function useTelemetry(): Telemetry {
  const module = useContext(TelemetryContext);
  if (!module) throw new Error('useTelemetry must be used inside <TelemetryProvider>');
  return module.telemetry;
}
