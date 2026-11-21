import type { TextDirectionDetector } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Seeds the reading direction of every sheet in a freshly transcribed
 * session from the transcript itself, in the store that holds the
 * session: the editor's, or the store of a session the editor has
 * left.
 *
 * Reads the whole transcript rather than any single line: captions are
 * fragments, and a fragment that happens to open with a foreign name
 * would speak for the rest of the video. Every sheet gets the same
 * answer because they all describe the same recording; the reader can
 * still change any of them afterwards.
 *
 * Runs without committing to the undo stack — preprocessing is not meant
 * to be reversible.
 */
export class ApplyTextDirectionAction {

  constructor(private readonly textDirectionDetector: TextDirectionDetector) {}

  execute(store: EditorStore): void {
    const { document, sheets } = store.snapshot();
    if (!document) return;
    const textDirection = this.textDirectionDetector.detect(document.getText());
    store.patch({ sheets: sheets.map((sheet) => sheet.with({ textDirection })) });
  }
}
