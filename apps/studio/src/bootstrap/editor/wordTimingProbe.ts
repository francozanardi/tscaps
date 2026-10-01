import type { EditorStore } from '@core/editor/store/EditorStore';

interface ProbedWord {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

declare global {
  interface Window {
    /** The words the local model returned for the last transcription, before anything else touched them. */
    __tscapsModelWords?: ReadonlyArray<ProbedWord>;
    /** The words of the document open in the editor, in document order. */
    __tscapsWordTimes?: () => ReadonlyArray<ProbedWord>;
  }
}

/**
 * Exposes the editor's word times on `window` in dev builds, so a
 * transcription can be compared against audio whose timing is known —
 * see `tools/sync-test`. Read from devtools with
 * `copy(JSON.stringify({ model: window.__tscapsModelWords, document: __tscapsWordTimes() }))`;
 * the model's words exist only after a local transcription.
 */
export function exposeWordTimingProbe(store: EditorStore): void {
  window.__tscapsWordTimes = () => (store.snapshot().document?.getWords() ?? []).map((word) => ({
    text: word.text,
    start: word.time.start,
    end: word.time.end,
  }));
}
