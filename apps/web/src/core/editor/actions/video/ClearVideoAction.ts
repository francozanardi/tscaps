import type { EditorStore } from '@core/editor/store/EditorStore';

export class ClearVideoAction {
  constructor(private readonly store: EditorStore) {}

  execute(): void {
    const { video } = this.store.snapshot();
    if (video.url) URL.revokeObjectURL(video.url);
    this.store.reset();
  }
}
