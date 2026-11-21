import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperationCatalog } from '@core/editor-operations/services/EditorOperationCatalog';
import type { EditorOperationRunner } from '@core/editor-operations/services/EditorOperationRunner';
import type { ExportVideoAction } from '@core/export/actions/ExportVideoAction';
import type { ProjectFramePictures } from '@core/export/domain/ProjectFramePictures';
import type { RedirectableExportWriterFactory } from '@core/export/services/RedirectableExportWriterFactory';
import type { PreprocessVideoAction } from '@core/preprocessing/actions/PreprocessVideoAction';
import type { SaveProjectAction } from '@core/projects/actions/SaveProjectAction';
import type { ProjectFileEncoder } from '@core/projects/services/ProjectFileEncoder';
import type { LoadVideoAction } from '@core/videos/actions/LoadVideoAction';
import { bootSurveyReframe, type ReframeDependencies } from '@bootstrap/wiring/reframe';
import { TakeChoiceReader } from '@core/reframe/services/TakeChoiceReader';
import { ReframeVideoMethod } from '@core/automation/services/methods/ReframeVideoMethod';
import { AddMediaMethod } from '@core/automation/services/methods/AddMediaMethod';
import { LookAtMediaMethod } from '@core/automation/services/methods/LookAtMediaMethod';
import { SaveGraphicPresetMethod } from '@core/automation/services/methods/SaveGraphicPresetMethod';
import { SaveTemplateMethod } from '@core/automation/services/methods/SaveTemplateMethod';
import { SearchHelpMethod } from '@core/automation/services/methods/SearchHelpMethod';
import type { ImportMediaAssetAction } from '@core/media/actions/ImportMediaAssetAction';
import type { MediaLooker } from '@core/media/services/MediaLooker';
import type { SheetTemplateSaver } from '@core/editor-operations/services/SheetTemplateSaver';
import type { GraphicPresetSaver } from '@core/editor-operations/services/GraphicPresetSaver';
import type { HelpAnswers } from '@core/help/services/HelpAnswers';
import { OutsideOperationWording } from '@core/automation/services/OutsideOperationWording';
import { ChannelExportFileTargets } from '@core/automation/infrastructure/ChannelExportFileTargets';
import { EventSourceAutomationChannel } from '@core/automation/infrastructure/EventSourceAutomationChannel';
import { FetchRemoteFileReader } from '@core/automation/infrastructure/FetchRemoteFileReader';
import type { TabAutomationSession } from '@core/automation/infrastructure/TabAutomationSession';
import { OffscreenCanvasBitmapPngEncoder } from '@core/automation/infrastructure/OffscreenCanvasBitmapPngEncoder';
import { AutomationDispatcher } from '@core/automation/services/AutomationDispatcher';
import { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import { EditorStatusReader } from '@core/automation/services/EditorStatusReader';
import { ExportVideoMethod } from '@core/automation/services/methods/ExportVideoMethod';
import { GetStatusMethod } from '@core/automation/services/methods/GetStatusMethod';
import { ListCheckpointsMethod } from '@core/automation/services/methods/ListCheckpointsMethod';
import { ListOperationsMethod } from '@core/automation/services/methods/ListOperationsMethod';
import { MoveInHistoryMethod } from '@core/automation/services/methods/MoveInHistoryMethod';
import { OpenVideoMethod } from '@core/automation/services/methods/OpenVideoMethod';
import { RenderFramesMethod } from '@core/automation/services/methods/RenderFramesMethod';
import { CanvasPictureSheetComposer } from '@core/pictures/infrastructure/CanvasPictureSheetComposer';
import { RunOperationMethod } from '@core/automation/services/methods/RunOperationMethod';
import { SaveProjectMethod } from '@core/automation/services/methods/SaveProjectMethod';
import { TitleCheckpointMethod } from '@core/automation/services/methods/TitleCheckpointMethod';
import { RequestReviewMethod } from '@core/automation/services/methods/RequestReviewMethod';
import { ResolveNotesMethod } from '@core/automation/services/methods/ResolveNotesMethod';
import type { ReviewNotesModule } from '@bootstrap/wiring/review-notes';

export interface AutomationDependencies {
  /** Whether, and for which session, a program opened this page to drive it. */
  readonly session: TabAutomationSession;
  readonly store: EditorStore;
  readonly catalog: EditorOperationCatalog;
  readonly runner: EditorOperationRunner;
  readonly frames: ProjectFramePictures;
  readonly exportVideo: ExportVideoAction;
  readonly exportWriters: RedirectableExportWriterFactory;
  readonly loadVideo: LoadVideoAction;
  readonly preprocessVideo: PreprocessVideoAction;
  readonly saveProject: SaveProjectAction;
  readonly projectFiles: ProjectFileEncoder;
  /** What the reframe workflow needs; its questions go to the program. */
  readonly reframe: ReframeDependencies;
  /** Adds a file to the open project's media bin. */
  readonly importMedia: ImportMediaAssetAction;
  /** Draws the person's files in the media bin to look at. */
  readonly mediaLooker: MediaLooker;
  readonly templateSaver: SheetTemplateSaver;
  readonly graphicPresetSaver: GraphicPresetSaver;
  /** The editor's help. */
  readonly help: HelpAnswers;
  /** The person's review notes: the batches they send, read and resolved by the program. */
  readonly reviewNotes: ReviewNotesModule;
}

export type AutomationModule = ReturnType<typeof bootAutomation>;

/**
 * Boots the automation bridge when the page was opened for a program
 * that drives the editor from outside it (an editing agent through a
 * local server): the program opens videos, runs the operation catalog,
 * looks at frames painted as the export paints them, reads and resolves
 * the review notes the person sends, moves through the history, reframes the video (by a survey of the people in each take), adds
 * and looks at media, saves templates and graphic presets, searches the
 * help and exports, over a channel to the server that served the
 * page. Null on an ordinary visit, which starts nothing. The same on
 * every surface.
 */
export function bootAutomation(deps: AutomationDependencies) {
  const token = deps.session.token();
  if (token === null) return null;
  const channel = new EventSourceAutomationChannel(token);
  const params = new AutomationParamsReader();
  const status = new EditorStatusReader(deps.store);
  const files = new FetchRemoteFileReader();
  const reframe = bootSurveyReframe(deps.reframe);
  const sheets = new CanvasPictureSheetComposer();
  const dispatcher = new AutomationDispatcher(channel, [
    new GetStatusMethod(status),
    new OpenVideoMethod(deps.store, files, deps.loadVideo, deps.preprocessVideo, status, params),
    new ListOperationsMethod(deps.catalog, new OutsideOperationWording()),
    new RunOperationMethod(deps.runner, params),
    new TitleCheckpointMethod(deps.store, params),
    new ListCheckpointsMethod(deps.store),
    new MoveInHistoryMethod(deps.store, params),
    new RenderFramesMethod(deps.frames, new OffscreenCanvasBitmapPngEncoder(), channel, params, sheets),
    new ExportVideoMethod(deps.store, deps.exportVideo, deps.exportWriters, new ChannelExportFileTargets(channel), params),
    new SaveProjectMethod(deps.store, deps.saveProject, deps.projectFiles, channel, params),
    new ReframeVideoMethod(reframe.workflow, reframe.readout, params, new TakeChoiceReader()),
    new AddMediaMethod(files, deps.importMedia, params),
    new LookAtMediaMethod(deps.mediaLooker, params),
    new SaveTemplateMethod(deps.templateSaver, params),
    new SaveGraphicPresetMethod(deps.graphicPresetSaver, params),
    new SearchHelpMethod(deps.help, params),
    new RequestReviewMethod(deps.store, deps.reviewNotes.batches, deps.reviewNotes.actions.describe, sheets, params),
    new ResolveNotesMethod(deps.store, deps.reviewNotes.actions.resolve, params),
  ]);
  dispatcher.start();
  return { dispatcher };
}
