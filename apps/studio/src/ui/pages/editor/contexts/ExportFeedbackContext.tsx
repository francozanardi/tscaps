import { createContext, useContext, type ReactNode } from 'react';
import type { ExportFeedbackController } from '@presentation/export/controllers/ExportFeedbackController';

const ExportFeedbackContext = createContext<ExportFeedbackController | null>(null);

interface ExportFeedbackProviderProps {
  value: ExportFeedbackController;
  children: ReactNode;
}

export function ExportFeedbackProvider({ value, children }: ExportFeedbackProviderProps) {
  return <ExportFeedbackContext.Provider value={value}>{children}</ExportFeedbackContext.Provider>;
}

/**
 * Returns the export feedback controller scoped to the editor route.
 * Throws if used outside `<EditorShellHost>` — that is always a
 * wiring bug.
 */
export function useExportFeedback(): ExportFeedbackController {
  const value = useContext(ExportFeedbackContext);
  if (!value) throw new Error('useExportFeedback must be used inside <EditorShellHost>');
  return value;
}
