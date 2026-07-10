import { createContext, useContext, type ReactNode } from 'react';
import type { ThemeController } from '@presentation/theme/controllers/ThemeController';

const ThemeContext = createContext<ThemeController | null>(null);

interface ThemeProviderProps {
  value: ThemeController;
  children: ReactNode;
}

export function ThemeProvider({ value, children }: ThemeProviderProps) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Returns the theme controller for the editor tree. Throws if used
 * outside `<ThemeProvider>` — that is always a wiring bug.
 */
export function useTheme(): ThemeController {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
