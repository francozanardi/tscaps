import type { EditorStore } from '@core/editor/store/EditorStore';

export class ClearVideoAction {
  constructor(private readonly editorStore: EditorStore) {}

  execute(): void {
    const { video } = this.editorStore.snapshot();
    if (video.url) URL.revokeObjectURL(video.url);
    this.editorStore.reset();
  }
}
