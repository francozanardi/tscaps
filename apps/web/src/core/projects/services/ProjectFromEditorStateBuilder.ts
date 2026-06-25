import type { EditorState } from '@core/editor/domain/EditorState';
import { Project } from '@core/projects/domain/Project';
import type { ProjectVideo } from '@core/projects/domain/ProjectVideo';

/**
 * Reconstructs the `Project` value object that corresponds to the
 * current editor state — same id, fresh `updatedAt`. Returns `null`
 * when the editor has no live project: no id, no creation timestamp,
 * or no loaded video file. Callers should treat `null` as
 * "nothing to persist".
 *
 * Does not touch any store, repository, or coordinator — pure
 * mapping from `EditorState` to `Project`.
 */
export class ProjectFromEditorStateBuilder {
  build(state: EditorState): Project | null {
    if (!state.projectId || !state.projectCreatedAt || !state.video.file) return null;
    return new Project(
      state.projectId,
      state.projectName,
      state.projectCreatedAt,
      new Date(),
      this.toProjectVideo(state.video.file, state.video.duration),
      state.video.layout,
      state.document,
      state.sheets,
      state.activeSheetId,
      state.wordStyleOverrides,
      state.segmentOverrides,
      state.decorationOverrides,
      state.cuts,
      state.projectThumbnail,
    );
  }

  private toProjectVideo(file: File, duration: number): ProjectVideo {
    return {
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      duration,
    };
  }
}
