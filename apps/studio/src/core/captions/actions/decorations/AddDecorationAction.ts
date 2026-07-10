import { Decoration, DocumentEditor } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

const docEditor = new DocumentEditor();

/**
 * Attaches a fresh decoration to the host word with the chosen glyph.
 * The decoration id follows the `${wordId}:d` convention shared with
 * transcription so per-decoration overrides line up. Replaces any
 * decoration the word already carried. Returns the new decoration id,
 * or the empty string when no word with the given id exists.
 */
export class AddDecorationAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(wordId: string, glyph: string): string {
    const snap = this.store.snapshot();
    const document = snap.document;
    if (!document) return '';

    const pos = docEditor.findWordById(document, wordId);
    if (!pos) return '';

    const decorationId = `${wordId}:d`;
    const decoration = new Decoration({ id: decorationId, glyph });
    const edited = docEditor.setWordDecoration(document, pos.segIdx, pos.lineIdx, pos.wordIdx, decoration);
    const nextOverrides = snap.decorationOverrides.with(decorationId, { source: 'user' });
    const next = this.deriver.reapplyEffects(edited, snap.sheets, snap.video.duration, nextOverrides);

    this.store.commit();
    this.store.patch({ document: next, decorationOverrides: nextOverrides });
    return decorationId;
  }
}
