import { SheetScriptsAutomation } from '@core/editor/automations/SheetScriptsAutomation';
import { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import { DecorationTimeResolver } from '@core/effect/services/DecorationTimeResolver';
import { InlineEmojiPunctuationAbsorber } from '@core/effect/services/InlineEmojiPunctuationAbsorber';
import { EditorStore } from '@core/editor/store/EditorStore';
import { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import { LocalStorageTranscribePreferenceRepository } from '@core/transcription/infrastructure/repositories/LocalStorageTranscribePreferenceRepository';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import { InitializeAction } from '@core/editor/actions/InitializeAction';
import type { EngineModule } from '@bootstrap/wiring/engine';
import type { RenderingModule } from '@bootstrap/wiring/rendering';

export interface EditorStoreDependencies {
  readonly localStorageClient: LocalStorageClient;
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
 */
export function bootEditorStore(deps: EditorStoreDependencies) {
  const transcribePreferenceRepository = new LocalStorageTranscribePreferenceRepository(
    deps.localStorageClient,
  );
  const store = new EditorStore(transcribePreferenceRepository.load());
  return { store, transcribePreferenceRepository };
}

/**
 * Boots the editor's shell on top of an already-built store: the
 * document deriver, the refresh action that re-derives the document
 * after a model edit, the initialize action that hydrates available
 * templates on first paint, and the video load / clear actions.
 *
 * Caption-mode actions (words, decorations, segments) live in
 * `bootCaptions`. Cut actions live in `bootCuts`.
 */
export function bootEditor(deps: EditorDependencies) {
  const store = deps.store;
  const transcribePreferenceRepository = deps.transcribePreferenceRepository;
  const deriver = new DocumentDeriver(
    [deps.engine.structureTagger, deps.engine.pauseTagger],
    deps.engine.segmentSplitters,
    deps.engine.lineSplitters,
    deps.engine.effects,
    deps.rendering.sheetCssVarsBuilder,
    new DecorationTimeResolver(),
    new InlineEmojiPunctuationAbsorber(),
  );
  const refresh = new RefreshDocumentAction(store, deriver, deps.rendering.sheetScriptsSynchronizer);

  return {
    store,
    deriver,
    refresh,
    sheetScriptsAutomation: new SheetScriptsAutomation(store, deps.rendering.sheetScriptsSynchronizer),
    transcribePreferenceRepository,
    actions: {
      initialize: new InitializeAction(store, deps.filteredTemplateRepository),
    },
  };
}
