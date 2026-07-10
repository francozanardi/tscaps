import { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import { DecorationTimeResolver } from '@core/effect/services/DecorationTimeResolver';
import { InlineEmojiPunctuationAbsorber } from '@core/effect/services/InlineEmojiPunctuationAbsorber';
import { EditorStore } from '@core/editor/store/EditorStore';
import { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import { LocalStorageTranscribePreferenceRepository } from '@core/transcription/infrastructure/repositories/LocalStorageTranscribePreferenceRepository';
import type { TemplateRepository } from '@core/templates/domain/TemplateRepository';
import type { UserAgentInspector } from '@core/_shared/infrastructure/UserAgentInspector';
import { LoadVideoAction } from '@core/editor/actions/video/LoadVideoAction';
import { ClearVideoAction } from '@core/editor/actions/video/ClearVideoAction';
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
 * Boots the editor's shell on top of an already-built store: the
 * document deriver, the refresh action that re-derives the document
 * after a model edit, the initialize action that hydrates available
 * templates on first paint, and the video load / clear actions.
 *
 * Caption-mode actions (words, decorations, segments) live in
 * `bootCaptions`. Cuts-mode actions live in `bootCuts`.
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
  const refresh = new RefreshDocumentAction(store, deriver);

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
    },
  };
}
