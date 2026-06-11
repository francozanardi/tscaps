import { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import { EditorStore } from '@core/editor/store/EditorStore';
import { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { LocalStorageClient } from '@core/_shared/LocalStorageClient';
import { LocalStorageTranscribePreferenceRepository } from '@core/transcription/infrastructure/repositories/LocalStorageTranscribePreferenceRepository';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import type { UserAgentInspector } from '@core/_shared/UserAgentInspector';
import { LoadVideoAction } from '@core/editor/actions/video/LoadVideoAction';
import { ClearVideoAction } from '@core/editor/actions/video/ClearVideoAction';
import { EditWordTextAction } from '@core/editor/actions/words/EditWordTextAction';
import { EditWordTimeAction } from '@core/editor/actions/words/EditWordTimeAction';
import { EditWordTagsAction } from '@core/editor/actions/words/EditWordTagsAction';
import { SetWordStyleOverrideAction } from '@core/editor/actions/words/SetWordStyleOverrideAction';
import { ClearWordAlignmentOverrideAction } from '@core/editor/actions/words/ClearWordAlignmentOverrideAction';
import { SetSegmentStyleOverrideAction } from '@core/editor/actions/segments/SetSegmentStyleOverrideAction';
import { DeleteWordsAction } from '@core/editor/actions/words/DeleteWordsAction';
import { ApplyStructureEditAction } from '@core/editor/actions/segments/ApplyStructureEditAction';
import { ApplySmartSegmentEditAction } from '@core/editor/actions/segments/ApplySmartSegmentEditAction';
import { SplitSegmentAtCursorAction } from '@core/editor/actions/segments/SplitSegmentAtCursorAction';
import { MergeSegmentWithSiblingAction } from '@core/editor/actions/segments/MergeSegmentWithSiblingAction';
import { EditSegmentTimeAction } from '@core/editor/actions/segments/EditSegmentTimeAction';
import { RedistributeSegmentWordsAction } from '@core/editor/actions/segments/RedistributeSegmentWordsAction';
import { InsertWordAction } from '@core/editor/actions/words/InsertWordAction';
import { InsertSegmentAction } from '@core/editor/actions/segments/InsertSegmentAction';
import { ResetSegmentLayoutAction } from '@core/editor/actions/segments/ResetSegmentLayoutAction';
import { ResetSheetLayoutAction } from '@core/editor/actions/segments/ResetSheetLayoutAction';
import { InitializeAction } from '@core/editor/actions/InitializeAction';
import type { EngineModule } from '@bootstrap/wiring/engine';
import type { RenderingModule } from '@bootstrap/wiring/rendering';

export interface EditorStoreDependencies {
  readonly localStorageClient: LocalStorageClient;
  readonly userAgentInspector: UserAgentInspector;
}

export interface EditorDependencies {
  readonly engine: EngineModule;
  readonly rendering: RenderingModule;
  readonly store: EditorStore;
  readonly transcribePreferenceRepository: LocalStorageTranscribePreferenceRepository;
  readonly filteredTemplateRepository: TemplateRepository;
}

export type EditorStoreModule = ReturnType<typeof bootEditorStore>;
export type EditorModule = ReturnType<typeof bootEditor>;

/**
 * Boots the editor's observable store and the persisted transcribe-
 * preference repository it hydrates from. Kept separate from the rest
 * of the editor module so the store is available early — `bootUserBlobs`
 * and `bootRendering` need it before the document deriver and the
 * surface actions can be wired.
 *
 * Low-end mobile devices struggle with anything above `tiny` — base / small
 * routinely run out of memory or take minutes per clip. Bias new mobile
 * users toward `tiny` so a first run on an unknown device at least
 * finishes; anyone who wants more accuracy can pick a larger model from
 * Advanced.
 */
export function bootEditorStore(deps: EditorStoreDependencies) {
  const transcribePreferenceRepository = new LocalStorageTranscribePreferenceRepository(
    deps.localStorageClient,
    deps.userAgentInspector.isMobile() ? { backend: 'wasm', model: 'tiny' } : undefined,
  );
  const store = new EditorStore(transcribePreferenceRepository.load());
  return { store, transcribePreferenceRepository };
}

/**
 * Boots the editor feature on top of an already-built store: the
 * document deriver, the refresh action that re-derives the document
 * after a model edit, and every video / word / segment / caption
 * action the editor surface drives.
 */
export function bootEditor(deps: EditorDependencies) {
  const store = deps.store;
  const transcribePreferenceRepository = deps.transcribePreferenceRepository;
  const deriver = new DocumentDeriver(
    deps.engine.structureTagger,
    deps.engine.segmentSplitters,
    deps.engine.lineSplitters,
    deps.engine.effects,
    deps.rendering.sheetCssVarsBuilder,
  );
  const refresh = new RefreshDocumentAction(store, deriver);
  const videoDurationProvider = () => store.snapshot().video.duration;

  return {
    store,
    deriver,
    refresh,
    transcribePreferenceRepository,
    actions: {
      initialize: new InitializeAction(store, deps.filteredTemplateRepository),
      video: {
        load: new LoadVideoAction(store),
        clear: new ClearVideoAction(store),
      },
      words: {
        editText: new EditWordTextAction(store, deriver),
        editTime: new EditWordTimeAction(store, deriver),
        editTags: new EditWordTagsAction(store, deriver),
        setStyleOverride: new SetWordStyleOverrideAction(store),
        clearAlignmentOverride: new ClearWordAlignmentOverrideAction(store),
        delete: new DeleteWordsAction(store, deriver),
        insert: new InsertWordAction(store, deriver),
      },
      segments: {
        setStyleOverride: new SetSegmentStyleOverrideAction(store),
        applyStructureEdit: new ApplyStructureEditAction(store, deriver),
        applySmartEdit: new ApplySmartSegmentEditAction(store, deriver, videoDurationProvider),
        splitAtCursor: new SplitSegmentAtCursorAction(store, deriver, videoDurationProvider),
        mergeWithSibling: new MergeSegmentWithSiblingAction(store, deriver, videoDurationProvider),
        editTime: new EditSegmentTimeAction(store, deriver),
        redistributeWords: new RedistributeSegmentWordsAction(store, deriver),
        insert: new InsertSegmentAction(store, deriver, videoDurationProvider),
        resetLayout: new ResetSegmentLayoutAction(store, refresh),
        resetSheetLayout: new ResetSheetLayoutAction(store, refresh),
      },
    },
  };
}
