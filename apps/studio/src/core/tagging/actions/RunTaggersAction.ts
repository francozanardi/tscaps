import type { EditorStore } from '@core/editor/store/EditorStore';
import type { TaggerRegistry } from '@core/tagging/services/TaggerRegistry';

/**
 * Runs every registered platform tagger over the current document
 * and writes the tagged document back to the editor store. No-op if
 * no document is loaded. Idempotent for deterministic taggers — a
 * second call produces the same semantic tags.
 */
export class RunTaggersAction {
  constructor(
    private readonly store: EditorStore,
    private readonly registry: TaggerRegistry,
  ) {}

  async execute(): Promise<void> {
    const document = this.store.snapshot().document;
    if (!document) return;
    const tagged = await this.registry.runAll(document);
    this.store.patch({ document: tagged });
  }
}
