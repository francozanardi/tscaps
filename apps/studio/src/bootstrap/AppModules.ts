import type { EngineModule } from '@bootstrap/wiring/engine';
import type { ProjectsModule } from '@bootstrap/wiring/projects';
import type { TemplatesModule } from '@bootstrap/wiring/templates';
import type { FontsModule } from '@bootstrap/wiring/fonts';
import type { ExportModule } from '@bootstrap/wiring/export';
import type { SheetsModule } from '@bootstrap/wiring/sheets';
import type { EditorModule } from '@bootstrap/wiring/editor';
import type { CaptionsModule } from '@bootstrap/wiring/captions';
import type { CutsModule } from '@bootstrap/wiring/cuts';
import type { ShotsModule } from '@bootstrap/wiring/shots';
import type { OutputFrameModule } from '@bootstrap/wiring/output-frame';
import type { AudioMixModule } from '@bootstrap/wiring/audio-mix';
import type { ColorGradeModule } from '@bootstrap/wiring/color-grade';
import type { ReviewNotesModule } from '@bootstrap/wiring/review-notes';
import type { MediaModule } from '@bootstrap/wiring/media';
import type { ElementsModule } from '@bootstrap/wiring/elements';
import type { PreviewModule } from '@bootstrap/wiring/preview';
import type { VideosModule } from '@bootstrap/wiring/videos';
import type { TranscriptionModule } from '@bootstrap/wiring/transcription';
import type { TaggingModule } from '@bootstrap/wiring/tagging';
import type { PreprocessingModule } from '@bootstrap/wiring/preprocessing';
import type { PersonSegmentationModule } from '@bootstrap/wiring/person-segmentation';
import type { SubjectTrackingModule } from '@bootstrap/wiring/subject-tracking';
import type { UtilsModule } from '@bootstrap/wiring/utils';
import type { ErrorsModule } from '@bootstrap/wiring/errors';
import type { RenderingModule } from '@bootstrap/wiring/rendering';
import type { RoutingModule } from '@bootstrap/wiring/routing';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import type { UserBlobsModule } from '@bootstrap/wiring/user-blobs';
import type { UserTemplatesModule } from '@bootstrap/wiring/user-templates';
import type { AssetLibraryModule } from '@bootstrap/wiring/asset-library';
import type { ShortcutsModule } from '@bootstrap/wiring/shortcuts';

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
  readonly shots: ShotsModule;
  readonly outputFrame: OutputFrameModule;
  readonly audioMix: AudioMixModule;
  readonly colorGrade: ColorGradeModule;
  readonly reviewNotes: ReviewNotesModule;
  readonly media: MediaModule;
  readonly elements: ElementsModule;
  readonly preview: PreviewModule;
  readonly projects: ProjectsModule;
  readonly videos: VideosModule;
  readonly templates: TemplatesModule;
  readonly sheets: SheetsModule;
  readonly transcription: TranscriptionModule;
  readonly tagging: TaggingModule;
  readonly preprocessing: PreprocessingModule;
  readonly personSegmentation: PersonSegmentationModule;
  /** Finding the people in frames of the video, and following one through a stretch of it. */
  readonly subjectTracking: SubjectTrackingModule;
  readonly exports: ExportModule;
  readonly fonts: FontsModule;
  readonly utils: UtilsModule;
  readonly errors: ErrorsModule;
  readonly rendering: RenderingModule;
  readonly routing: RoutingModule;
  readonly telemetry: TelemetryModule;
  readonly userBlobs: UserBlobsModule;
  readonly userTemplates: UserTemplatesModule;
  readonly assetLibrary: AssetLibraryModule;
  readonly shortcuts: ShortcutsModule;
}
