import { createContext, useContext, type ReactNode } from 'react';
import type { EditorNavigationTelemetryReporter } from '@presentation/telemetry/services/EditorNavigationTelemetryReporter';

const EditorNavigationTelemetryContext = createContext<EditorNavigationTelemetryReporter | null>(null);

interface EditorNavigationTelemetryProviderProps {
  value: EditorNavigationTelemetryReporter;
  children: ReactNode;
}

export function EditorNavigationTelemetryProvider({ value, children }: EditorNavigationTelemetryProviderProps) {
  return (
    <EditorNavigationTelemetryContext.Provider value={value}>
      {children}
    </EditorNavigationTelemetryContext.Provider>
  );
}

/**
 * Returns the editor's navigation reporter, one per page load. Throws if
 * mounted outside `<EditorNavigationTelemetryProvider>`; that is always a
 * wiring bug and should surface loudly.
 */
export function useEditorNavigationTelemetry(): EditorNavigationTelemetryReporter {
  const value = useContext(EditorNavigationTelemetryContext);
  if (!value) throw new Error('useEditorNavigationTelemetry must be used inside <EditorNavigationTelemetryProvider>');
  return value;
}
