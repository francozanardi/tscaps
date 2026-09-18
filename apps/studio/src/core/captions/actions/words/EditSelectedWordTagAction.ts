import { DocumentEditor, Tag } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { WordTagEditTelemetryReporter } from '@core/captions/services/WordTagEditTelemetryReporter';

const documentEditor = new DocumentEditor();

/** Adds or removes one semantic tag across a word selection in one undoable edit. */
export class EditSelectedWordTagAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly telemetryReporter: WordTagEditTelemetryReporter,
  ) {}

  execute(args: { wordIds: ReadonlySet<string>; tagName: string; enabled: boolean }): void {
    const snapshot = this.store.snapshot();
    if (!snapshot.document || args.wordIds.size === 0) return;

    let edited = snapshot.document;
    let changedCount = 0;
    for (const wordId of args.wordIds) {
      const position = documentEditor.findWordById(edited, wordId);
      if (!position) continue;
      const word = edited.getSegments()[position.segIdx]?.lines[position.lineIdx]?.words[position.wordIdx];
      if (!word) continue;

      const names = new Set([...word.semanticTags].map((tag) => tag.name));
      if (args.enabled === names.has(args.tagName)) continue;
      if (args.enabled) names.add(args.tagName);
      else names.delete(args.tagName);

      const semanticTags = new Set([...names].map((name) => Tag.of(name)));
      edited = documentEditor.replaceWordAt(
        edited,
        position.segIdx,
        position.lineIdx,
        position.wordIdx,
        [word.with({ semanticTags })],
      );
      changedCount++;
    }
    if (changedCount === 0) return;

    const document = this.deriver.reapplyEffects(
      edited,
      snapshot.sheets,
      snapshot.video.duration,
      snapshot.decorationOverrides,
    );
    this.store.commit(`selected-word-tag:${args.tagName}`);
    this.store.patch({ document });
    this.telemetryReporter.report({
      tagName: args.tagName,
      enabled: args.enabled,
      source: 'selection',
      wordCount: changedCount,
    });
  }
}
