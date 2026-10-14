import { createContext, useContext, type ReactNode } from 'react';
import type { SubtreeIsolationMarks } from '@tscaps/engine';
import { SubtreeIsolationMarksFactory } from '@presentation/editor/services/SubtreeIsolationMarksFactory';

/** Shared with the layer that mounts the copies, so both hand out marks the same way. */
export const subtreeIsolationMarksFactory = new SubtreeIsolationMarksFactory();

const NO_ISOLATION = subtreeIsolationMarksFactory.none();

const IsolationMarksContext = createContext<SubtreeIsolationMarks | null>(null);

interface IsolationMarksProviderProps {
  value: SubtreeIsolationMarks;
  children: ReactNode;
}

/**
 * Says which isolation classes the segment subtree below it carries:
 * the original that hides what its copies paint, or a copy that paints
 * only that. The engine decides every class, so the preview stamps the
 * same elements the export does.
 */
export function IsolationMarksProvider({ value, children }: IsolationMarksProviderProps) {
  return <IsolationMarksContext.Provider value={value}>{children}</IsolationMarksContext.Provider>;
}

/** The marks of the subtree being rendered; marks that stamp nothing outside any provider. */
export function useIsolationMarks(): SubtreeIsolationMarks {
  return useContext(IsolationMarksContext) ?? NO_ISOLATION;
}
