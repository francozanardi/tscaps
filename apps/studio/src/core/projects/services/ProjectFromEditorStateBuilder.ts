import type { EditorState } from '@core/editor/domain/EditorState';
import type { VideoState } from '@core/editor/domain/VideoState';
import { Project } from '@core/projects/domain/Project';
import type { ProjectVideo } from '@core/projects/domain/ProjectVideo';

/**
 * Reconstructs the `Project` value object that corresponds to the
 * current editor state — same id, fresh `updatedAt`. Returns `null`
 * when the editor has no live project: no id, no creation timestamp,
 * or no committed video identity. Callers should treat `null` as
 * "nothing to persist".
 *
 * The video identity is read from `state.video.{fileName, mimeType,
 * size, duration}` rather than the `File`, so a project whose
 * original bytes are still streaming in from a remote store is still
 * persistable.
 *
 * Does not touch any store, repository, or coordinator — pure
 * mapping from `EditorState` to `Project`.
 */
export class ProjectFromEditorStateBuilder {
  build(state: EditorState): Project | null {
    if (!state.projectId || !state.projectCreatedAt) return null;
    const projectVideo = this.tryBuildProjectVideo(state.video);
    if (!projectVideo) return null;
    return new Project(
      state.projectId,
      state.projectName,
      state.projectCreatedAt,
      new Date(),
      projectVideo,
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

  private tryBuildProjectVideo(video: VideoState): ProjectVideo | null {
    if (video.fileName === null || video.mimeType === null || video.size === null) return null;
    return {
      fileName: video.fileName,
      mimeType: video.mimeType,
      size: video.size,
      duration: video.duration,
    };
  }
}
