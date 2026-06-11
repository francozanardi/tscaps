import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Loads a freshly chosen video file into the editor as a brand-new editing
 * session. Delegates the full reset to `store.reset()` so the next
 * persistence event creates a new Project from the same baseline as a
 * freshly initialised app, not from whatever the previous project left
 * behind in the shared store.
 *
 * LoadProjectAction is the counterpart for opening an existing Project from
 * the dashboard; it patches the same fields directly without going through
 * this action.
 */
export class LoadVideoAction {
  constructor(private readonly store: EditorStore) {}

  execute(file: File): void {
    const { video } = this.store.snapshot();
    if (video.url) URL.revokeObjectURL(video.url);

    this.store.reset({
      video: {
        file,
        url: URL.createObjectURL(file),
      },
    });
  }
}
