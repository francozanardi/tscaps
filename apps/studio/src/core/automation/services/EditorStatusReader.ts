import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * What a program driving the editor needs to know about it at a glance:
 * whether a project is open and ready, its video, and the error the
 * editor shows.
 */
export class EditorStatusReader {
  constructor(private readonly store: EditorStore) {}

  read(): unknown {
    const state = this.store.snapshot();
    return {
      status: state.status,
      projectId: state.projectId,
      error: state.error === null ? null : { name: state.error.name, message: state.error.message },
      video: state.video.file === null ? null : {
        fileName: state.video.file.name,
        durationSec: state.video.duration,
        width: state.video.layout?.width ?? null,
        height: state.video.layout?.height ?? null,
      },
      segments: state.document?.sections.reduce((count, section) => count + section.segments.length, 0) ?? 0,
    };
  }
}
