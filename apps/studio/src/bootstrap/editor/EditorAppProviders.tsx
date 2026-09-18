import { useMemo } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import type { AppModules } from '@bootstrap/AppModules';
import { UserFontsBridge } from '@ui/_shared/contexts/UserFontsContext';
import { ToastStackProvider } from '@ui/_shared/components/Toast/ToastStack';
import { EngineProvider } from '@ui/_shared/contexts/modules/EngineContext';
import { UtilsProvider } from '@ui/_shared/contexts/modules/UtilsContext';
import { ErrorsProvider } from '@ui/_shared/contexts/modules/ErrorsContext';
import { RoutingProvider } from '@ui/_shared/contexts/modules/RoutingContext';
import { RenderingProvider } from '@ui/_shared/contexts/modules/RenderingContext';
import { TemplatePreviewArtifactsProvider } from '@ui/_shared/contexts/TemplatePreviewArtifactsContext';
import { TemplatePreviewArtifactsBuilder } from '@presentation/editor/services/TemplatePreviewArtifactsBuilder';
import { SheetsProvider } from '@ui/_shared/contexts/modules/SheetsContext';
import { TaggingProvider } from '@ui/_shared/contexts/modules/TaggingContext';
import { EditorProvider } from '@ui/_shared/contexts/modules/EditorContext';
import { CaptionsProvider } from '@ui/_shared/contexts/modules/CaptionsContext';
import { CutsProvider } from '@ui/_shared/contexts/modules/CutsContext';
import { ElementsProvider } from '@ui/_shared/contexts/modules/ElementsContext';
import { PreviewProvider } from '@ui/_shared/contexts/modules/PreviewContext';
import { VideosProvider } from '@ui/_shared/contexts/modules/VideosContext';
import { TranscriptionProvider } from '@ui/_shared/contexts/modules/TranscriptionContext';
import { PreprocessingProvider } from '@ui/_shared/contexts/modules/PreprocessingContext';
import { PersonSegmentationProvider } from '@ui/_shared/contexts/modules/PersonSegmentationContext';
import { ProjectsProvider } from '@ui/_shared/contexts/modules/ProjectsContext';
import { TemplatesProvider } from '@ui/_shared/contexts/modules/TemplatesContext';
import { ExportProvider } from '@ui/_shared/contexts/modules/ExportContext';
import { TelemetryProvider } from '@ui/_shared/contexts/modules/TelemetryContext';
import { UserBlobsProvider } from '@ui/_shared/contexts/modules/UserBlobsContext';
import { UserTemplatesProvider } from '@ui/_shared/contexts/modules/UserTemplatesContext';
import { AssetLibraryProvider } from '@ui/_shared/contexts/modules/AssetLibraryContext';

interface EditorAppProvidersProps {
  modules: AppModules;
  children: ReactNode;
}

/**
 * Wraps the editor tree in every feature-module context provider and
 * the cross-cutting providers (fonts, radix tooltip, toast stacks). Lives apart
 * from `EditorApp` so the provider pyramid does not drown the
 * routing layout in noise.
 */
export function EditorAppProviders({ modules, children }: EditorAppProvidersProps) {
  // Built here rather than inside the editor, because the developer
  // pages draw the same previews and a second builder would be a second
  // set of scoped stylesheets for the same templates.
  const templatePreviewArtifacts = useMemo(
    () => new TemplatePreviewArtifactsBuilder(
      modules.rendering.typographyCssVarBuilder,
      modules.rendering.rotationCssVarBuilder,
      modules.rendering.styleValuesCssVarsBuilder,
      modules.rendering.fontStackCssVarsBuilder,
    ),
    [modules.rendering],
  );

  return (
    <TelemetryProvider value={modules.telemetry}>
            <ErrorsProvider value={modules.errors}>
            <UtilsProvider value={modules.utils}>
              <RoutingProvider value={modules.routing}>
                <TranscriptionProvider value={modules.transcription}>
                  <PreprocessingProvider value={modules.preprocessing}>
                    <PersonSegmentationProvider value={modules.personSegmentation}>
                    <ProjectsProvider value={modules.projects}>
                      <TemplatesProvider value={modules.templates}>
                          <ExportProvider value={modules.exports}>
                            <EditorProvider value={modules.editor}>
                              <CaptionsProvider value={modules.captions}>
                                <CutsProvider value={modules.cuts}>
                                  <ElementsProvider value={modules.elements}>
                                  <PreviewProvider value={modules.preview}>
                                  <VideosProvider value={modules.videos}>
                                  <EngineProvider value={modules.engine}>
                                    <RenderingProvider value={modules.rendering}>
                                      <TemplatePreviewArtifactsProvider value={templatePreviewArtifacts}>
                                      <SheetsProvider value={modules.sheets}>
                                        <TaggingProvider value={modules.tagging}>
                                          <UserBlobsProvider value={modules.userBlobs}>
                                            <UserTemplatesProvider value={modules.userTemplates}>
                                              <AssetLibraryProvider value={modules.assetLibrary}>
                                                <UserFontsBridge
                                                  upload={(file) => modules.fonts.actions.upload.execute(file)}
                                                  delete={(id) => modules.fonts.actions.delete.execute(id)}
                                                >
                                                  <RadixTooltip.Provider delayDuration={200} skipDelayDuration={500} disableHoverableContent>
                                                    <ToastStackProvider>
                                                      {children}
                                                    </ToastStackProvider>
                                                  </RadixTooltip.Provider>
                                                </UserFontsBridge>
                                              </AssetLibraryProvider>
                                            </UserTemplatesProvider>
                                          </UserBlobsProvider>
                                        </TaggingProvider>
                                      </SheetsProvider>
                                      </TemplatePreviewArtifactsProvider>
                                    </RenderingProvider>
                                  </EngineProvider>
                                  </VideosProvider>
                                  </PreviewProvider>
                                  </ElementsProvider>
                                </CutsProvider>
                              </CaptionsProvider>
                            </EditorProvider>
                          </ExportProvider>
                      </TemplatesProvider>
                    </ProjectsProvider>
                    </PersonSegmentationProvider>
                  </PreprocessingProvider>
                </TranscriptionProvider>
              </RoutingProvider>
            </UtilsProvider>
            </ErrorsProvider>
    </TelemetryProvider>
  );
}
