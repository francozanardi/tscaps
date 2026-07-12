import { createContext, useContext, type ReactNode } from 'react';

const StartFlowSlotContext = createContext<ReactNode | null>(null);

/** Provides the caller-supplied replacement for the built-in start flow. `null` means fall back to the default. */
export function StartFlowSlotProvider({
  value,
  children,
}: {
  value: ReactNode | null;
  children: ReactNode;
}) {
  return <StartFlowSlotContext.Provider value={value}>{children}</StartFlowSlotContext.Provider>;
}

/** Reads the caller-supplied start flow; returns `null` when no override was passed. */
export function useStartFlowSlot(): ReactNode | null {
  return useContext(StartFlowSlotContext);
}
