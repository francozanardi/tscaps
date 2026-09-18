import { createContext, useContext, type ReactNode } from 'react';

const AppExitContext = createContext<string | null>(null);

/** Provides the URL a tree without a project workspace leaves to; `null` when it has one. */
export function AppExitProvider({
  value,
  children,
}: {
  value: string | null;
  children: ReactNode;
}) {
  return <AppExitContext.Provider value={value}>{children}</AppExitContext.Provider>;
}

/** Reads the URL the app leaves to; `null` when the tree has a project workspace. */
export function useAppExit(): string | null {
  return useContext(AppExitContext);
}
