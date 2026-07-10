import { DocumentEditor, type Document } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';

const docEditor = new DocumentEditor();

/**
 * Removes the decoration the user sees on a word. User-added decorations
 * are dropped from the document outright; AI-sourced decorations live in
 * the persisted document and are hidden instead by flagging the override
 * as `removed`, so re-deriving the document cannot bring them back.
 * No-op when the decoration is no longer present.
 */
export class ClearDecorationAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(decorationId: string): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    if (!document) return;
    const position = docEditor.findWordByDecorationId(document, decorationId);
    if (!position) return;

    const isUserAdded = snap.decorationOverrides.get(decorationId).source === 'user';
    const { nextDoc, nextOverrides } = isUserAdded
      ? this.dropUserDecoration(document, position, decorationId, snap.decorationOverrides)
      : this.hideAiDecoration(document, decorationId, snap.decorationOverrides);

    const derived = this.deriver.reapplyEffects(nextDoc, snap.sheets, snap.video.duration, nextOverrides);
    this.store.commit();
    this.store.patch({ document: derived, decorationOverrides: nextOverrides });
  }

  private dropUserDecoration(
    document: Document,
    position: { segIdx: number; lineIdx: number; wordIdx: number },
    decorationId: string,
    overrides: DecorationOverrideRegistry,
  ): { nextDoc: Document; nextOverrides: DecorationOverrideRegistry } {
    return {
      nextDoc: docEditor.clearWordDecoration(document, position.segIdx, position.lineIdx, position.wordIdx),
      nextOverrides: overrides.with(decorationId, {}),
    };
  }

  private hideAiDecoration(
    document: Document,
    decorationId: string,
    overrides: DecorationOverrideRegistry,
  ): { nextDoc: Document; nextOverrides: DecorationOverrideRegistry } {
    return {
      nextDoc: document,
      nextOverrides: overrides.with(decorationId, { removed: true }),
    };
  }
}
