import { createContext, useContext, type ReactNode } from 'react';
import type { TemplatePreviewArtifactsBuilder } from '@presentation/editor/services/TemplatePreviewArtifactsBuilder';

const TemplatePreviewArtifactsContext = createContext<TemplatePreviewArtifactsBuilder | null>(null);

interface TemplatePreviewArtifactsProviderProps {
  value: TemplatePreviewArtifactsBuilder;
  children: ReactNode;
}

export function TemplatePreviewArtifactsProvider({ value, children }: TemplatePreviewArtifactsProviderProps) {
  return <TemplatePreviewArtifactsContext.Provider value={value}>{children}</TemplatePreviewArtifactsContext.Provider>;
}

export function useTemplatePreviewArtifactsBuilder(): TemplatePreviewArtifactsBuilder {
  const value = useContext(TemplatePreviewArtifactsContext);
  if (!value) throw new Error('useTemplatePreviewArtifactsBuilder must be used inside <TemplatePreviewArtifactsProvider>');
  return value;
}
