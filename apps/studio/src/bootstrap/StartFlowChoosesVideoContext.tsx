import { createContext, useContext, type ReactNode } from 'react';

const StartFlowChoosesVideoContext = createContext<boolean>(false);

/** Provides whether the start flow asks for the video itself, so the editor may open without one. */
export function StartFlowChoosesVideoProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return <StartFlowChoosesVideoContext.Provider value={value}>{children}</StartFlowChoosesVideoContext.Provider>;
}

/** Reads whether the start flow asks for the video itself; `false` unless the caller said so. */
export function useStartFlowChoosesVideo(): boolean {
  return useContext(StartFlowChoosesVideoContext);
}
