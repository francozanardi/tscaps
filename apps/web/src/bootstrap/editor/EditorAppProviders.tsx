import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import type { AppModules } from '@bootstrap/AppModules';
import { UserFontsBridge } from '@ui/_shared/contexts/UserFontsContext';
import { EngineProvider } from '@ui/_shared/contexts/modules/EngineContext';
import { UtilsProvider } from '@ui/_shared/contexts/modules/UtilsContext';
import { RoutingProvider } from '@ui/_shared/contexts/modules/RoutingContext';
import { RenderingProvider } from '@ui/_shared/contexts/modules/RenderingContext';
import { SheetsProvider } from '@ui/_shared/contexts/modules/SheetsContext';
import { TaggingProvider } from '@ui/_shared/contexts/modules/TaggingContext';
import { EditorProvider } from '@ui/_shared/contexts/modules/EditorContext';
import { CaptionsProvider } from '@ui/_shared/contexts/modules/CaptionsContext';
import { CutsProvider } from '@ui/_shared/contexts/modules/CutsContext';
import { TranscriptionProvider } from '@ui/_shared/contexts/modules/TranscriptionContext';
import { PreprocessingProvider } from '@ui/_shared/contexts/modules/PreprocessingContext';
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
 * the cross-cutting providers (fonts, radix tooltip). Lives apart
 * from `EditorApp` so the provider pyramid does not drown the
 * routing layout in noise.
 */
export function EditorAppProviders({ modules, children }: EditorAppProvidersProps) {
  return (
    <TelemetryProvider value={modules.telemetry}>
            <UtilsProvider value={modules.utils}>
              <RoutingProvider value={modules.routing}>
                <TranscriptionProvider value={modules.transcription}>
                  <PreprocessingProvider value={modules.preprocessing}>
                    <ProjectsProvider value={modules.projects}>
                      <TemplatesProvider value={modules.templates}>
                          <ExportProvider value={modules.exports}>
                            <EditorProvider value={modules.editor}>
                              <CaptionsProvider value={modules.captions}>
                                <CutsProvider value={modules.cuts}>
                                  <EngineProvider value={modules.engine}>
                                    <RenderingProvider value={modules.rendering}>
                                      <SheetsProvider value={modules.sheets}>
                                        <TaggingProvider value={modules.tagging}>
                                          <UserBlobsProvider value={modules.userBlobs}>
                                            <UserTemplatesProvider value={modules.userTemplates}>
                                              <AssetLibraryProvider value={modules.assetLibrary}>
                                                <UserFontsBridge
                                                  upload={(file) => modules.fonts.actions.upload.execute(file)}
                                                  delete={(id) => modules.fonts.actions.delete.execute(id)}
                                                >
                                                  <RadixTooltip.Provider delayDuration={200} skipDelayDuration={0}>
                                                    {children}
                                                  </RadixTooltip.Provider>
                                                </UserFontsBridge>
                                              </AssetLibraryProvider>
                                            </UserTemplatesProvider>
                                          </UserBlobsProvider>
                                        </TaggingProvider>
                                      </SheetsProvider>
                                    </RenderingProvider>
                                  </EngineProvider>
                                </CutsProvider>
                              </CaptionsProvider>
                            </EditorProvider>
                          </ExportProvider>
                      </TemplatesProvider>
                    </ProjectsProvider>
                  </PreprocessingProvider>
                </TranscriptionProvider>
              </RoutingProvider>
            </UtilsProvider>
    </TelemetryProvider>
  );
}
