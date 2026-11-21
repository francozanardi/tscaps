import type { EditorStore } from '@core/editor/store/EditorStore';
import type { TaggerRegistry } from '@core/tagging/services/TaggerRegistry';

/**
 * Runs every registered platform tagger over the document of an editor
 * session and writes the tagged document back to the store it was read
 * from: the editor's, or the store of a session the editor has left.
 * No-op if no document is loaded. Idempotent for deterministic taggers —
 * a second call produces the same semantic tags.
 *
 * Writes nothing when the store's document changed while the taggers
 * ran, as when another video was opened meanwhile: the tags describe a
 * document the store no longer holds.
 */
export class RunTaggersAction {
  constructor(private readonly registry: TaggerRegistry) {}

  async execute(store: EditorStore): Promise<void> {
    const document = store.snapshot().document;
    if (!document) return;
    const tagged = await this.registry.runAll(document);
    if (store.snapshot().document !== document) return;
    store.patch({ document: tagged });
  }
}
