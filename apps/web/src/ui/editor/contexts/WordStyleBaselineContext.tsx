import { createContext, useContext, type ReactNode } from 'react';
import type { WordStyleBaselineResolver } from '@presentation/editor/services/WordStyleBaselineResolver';

const WordStyleBaselineContext = createContext<WordStyleBaselineResolver | null>(null);

interface WordStyleBaselineProviderProps {
  value: WordStyleBaselineResolver;
  children: ReactNode;
}

export function WordStyleBaselineProvider({ value, children }: WordStyleBaselineProviderProps) {
  return <WordStyleBaselineContext.Provider value={value}>{children}</WordStyleBaselineContext.Provider>;
}

export function useWordStyleBaselineResolver(): WordStyleBaselineResolver {
  const value = useContext(WordStyleBaselineContext);
  if (!value) throw new Error('useWordStyleBaselineResolver must be used inside <WordStyleBaselineProvider>');
  return value;
}
