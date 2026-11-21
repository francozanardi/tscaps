import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

/**
 * Derives the captions again whenever the stretches where they are kept
 * off change: a graphic that hides them added, removed or switched, its
 * shot moved, split or joined, or any of that undone. The derivation is
 * what cuts the scenes at those stretches and hides the ones inside, so a
 * caption never shows over a hook nor stays hidden after it.
 */
export class CaptionlessSpanRefresher {
  private lastKey: string | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  /** Starts listening, taking the stretches now as the ones already derived; returns what stops it. */
  start(): () => void {
    this.lastKey = this.keyNow();
    const listener = () => this.onChange();
    this.store.addEventListener('change', listener);
    return () => this.store.removeEventListener('change', listener);
  }

  private onChange(): void {
    const key = this.keyNow();
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.refresh.execute();
  }

  private keyNow(): string {
    const { shots, video } = this.store.snapshot();
    return JSON.stringify(shots.captionlessSpans(video.duration));
  }
}
