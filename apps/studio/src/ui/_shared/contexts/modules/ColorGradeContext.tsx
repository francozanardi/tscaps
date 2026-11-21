import { createContext, useContext, type ReactNode } from 'react';
import type { ColorGradeModule } from '@bootstrap/wiring/color-grade';

const ColorGradeContext = createContext<ColorGradeModule | null>(null);

interface ColorGradeProviderProps {
  value: ColorGradeModule;
  children: ReactNode;
}

export function ColorGradeProvider({ value, children }: ColorGradeProviderProps) {
  return <ColorGradeContext.Provider value={value}>{children}</ColorGradeContext.Provider>;
}

/**
 * Returns the colour grade module — the looks and what grades the
 * picture. Throws if mounted outside `<ColorGradeProvider>`; that is
 * always a wiring bug and should surface loudly.
 */
export function useColorGrade(): ColorGradeModule {
  const value = useContext(ColorGradeContext);
  if (!value) throw new Error('useColorGrade must be used inside <ColorGradeProvider>');
  return value;
}
