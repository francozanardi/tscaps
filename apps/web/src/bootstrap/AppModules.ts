import type { EngineModule } from '@bootstrap/wiring/engine';
import type { ProjectsModule } from '@bootstrap/wiring/projects';
import type { TemplatesModule } from '@bootstrap/wiring/templates';
import type { FontsModule } from '@bootstrap/wiring/fonts';
import type { ExportModule } from '@bootstrap/wiring/export';
import type { SheetsModule } from '@bootstrap/wiring/sheets';
import type { EditorModule } from '@bootstrap/wiring/editor';
import type { CaptionsModule } from '@bootstrap/wiring/captions';
import type { CutsModule } from '@bootstrap/wiring/cuts';
import type { TranscriptionModule } from '@bootstrap/wiring/transcription';
import type { TaggingModule } from '@bootstrap/wiring/tagging';
import type { PreprocessingModule } from '@bootstrap/wiring/preprocessing';
import type { UtilsModule } from '@bootstrap/wiring/utils';
import type { RenderingModule } from '@bootstrap/wiring/rendering';
import type { RoutingModule } from '@bootstrap/wiring/routing';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import type { UserBlobsModule } from '@bootstrap/wiring/user-blobs';
import type { UserTemplatesModule } from '@bootstrap/wiring/user-templates';
import type { AssetLibraryModule } from '@bootstrap/wiring/asset-library';

/**
 * Every wired feature module the editor tree consumes. Mounted by
 * `EditorApp` and threaded through `EditorAppProviders` so every
 * context resolves without prop drilling.
 */
export interface AppModules {
  readonly engine: EngineModule;
  readonly editor: EditorModule;
  readonly captions: CaptionsModule;
  readonly cuts: CutsModule;
  readonly projects: ProjectsModule;
  readonly templates: TemplatesModule;
  readonly sheets: SheetsModule;
  readonly transcription: TranscriptionModule;
  readonly tagging: TaggingModule;
  readonly preprocessing: PreprocessingModule;
  readonly exports: ExportModule;
  readonly fonts: FontsModule;
  readonly utils: UtilsModule;
  readonly rendering: RenderingModule;
  readonly routing: RoutingModule;
  readonly telemetry: TelemetryModule;
  readonly userBlobs: UserBlobsModule;
  readonly userTemplates: UserTemplatesModule;
  readonly assetLibrary: AssetLibraryModule;
}
