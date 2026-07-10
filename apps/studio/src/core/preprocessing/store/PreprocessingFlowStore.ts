import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Observable boolean derived from the editor state: a video is loaded,
 * no document exists yet, and the editor is idle. Flips through
 * `'change'` events only when the boolean itself changes — consumers do
 * not see intermediate editor-store mutations.
 *
 * Has no business logic; it is a thin projection of the editor state.
 */
export class PreprocessingFlowStore extends EventTarget {
  private _dialogOpen = false;

  constructor(private readonly editorStore: EditorStore) {
    super();
  }

  start(): void {
    this.editorStore.addEventListener('change', this.recompute);
    this.recompute();
  }

  stop(): void {
    this.editorStore.removeEventListener('change', this.recompute);
  }

  get dialogOpen(): boolean {
    return this._dialogOpen;
  }

  private readonly recompute = (): void => {
    const next = this.computeFromEditor();
    if (next === this._dialogOpen) return;
    this._dialogOpen = next;
    this.dispatchEvent(new Event('change'));
  };

  private computeFromEditor(): boolean {
    const { video, document, status } = this.editorStore.snapshot();
    return Boolean(video.url) && !document && status === 'idle';
  }
}
