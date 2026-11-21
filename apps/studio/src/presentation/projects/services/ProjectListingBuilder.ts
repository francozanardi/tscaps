import type { EditorState } from '@core/editor/domain/EditorState';
import type { PreprocessingProgressStatus } from '@core/preprocessing/domain/PreprocessingProgressStatus';
import type { PreprocessingRun } from '@core/preprocessing/services/PreprocessingRun';
import { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';

/** A project a run in this tab is still working on. */
export interface ProjectInProgress {
  readonly project: ProjectMetadata;
  /**
   * True while the editor still shows the project, so opening it goes
   * back to that editor. Once the reader opened another video, the
   * project cannot be opened until its run is over.
   */
  readonly openable: boolean;
  /** How far the run is, as its own progress says when the listing is built. */
  readonly progress: PreprocessingProgressStatus;
}

/** What a projects page lists, split by where each project stands. */
export interface ProjectListing {
  /** The projects runs in this tab are still working on. */
  readonly inProgress: readonly ProjectInProgress[];
  /**
   * The stored projects no run in this tab is working on, in the order
   * they were given. One with no document is unfinished.
   */
  readonly stored: readonly ProjectMetadata[];
}

/**
 * Splits what a projects page lists between the projects runs in this
 * tab are still working on and the stored ones.
 *
 * A stored project is finished once it has a document. Without one it
 * is in progress while a run in this tab works on it, and unfinished
 * otherwise: its run failed, or ended with its tab, before the captions
 * were made. A project a run in this tab works on is listed in progress
 * even before the store has it, and stops being listed in progress as
 * soon as the store has it finished.
 *
 * One entry per project. Two runs work on the same project when the
 * reader starts again on a project whose run failed while that run is
 * still saving it; the one whose session the editor shows is kept.
 */
export class ProjectListingBuilder {
  build(runs: readonly PreprocessingRun[], stored: readonly ProjectMetadata[]): ProjectListing {
    const finishedIds = new Set(stored.filter((project) => project.hasDocument).map((project) => project.id));
    const inProgress = this.inProgressOf(runs, finishedIds);
    const inProgressIds = new Set(inProgress.map((entry) => entry.project.id));
    return {
      inProgress,
      stored: stored.filter((project) => !inProgressIds.has(project.id)),
    };
  }

  private inProgressOf(runs: readonly PreprocessingRun[], finishedIds: ReadonlySet<string>): ProjectInProgress[] {
    const byProject = new Map<string, ProjectInProgress>();
    for (const run of runs) {
      const project = this.projectOf(run.latestState());
      if (!project || finishedIds.has(project.id)) continue;
      const entry: ProjectInProgress = { project, openable: run.ownsEditor(), progress: run.progress.status };
      const kept = byProject.get(project.id);
      if (!kept || (entry.openable && !kept.openable)) byProject.set(project.id, entry);
    }
    return [...byProject.values()];
  }

  private projectOf(state: EditorState): ProjectMetadata | null {
    if (state.projectId === null) return null;
    const createdAt = state.projectCreatedAt ?? new Date();
    return new ProjectMetadata(
      state.projectId,
      state.projectName,
      createdAt,
      createdAt,
      {
        fileName: state.video.fileName ?? '',
        mimeType: state.video.mimeType ?? '',
        size: state.video.size ?? 0,
        duration: state.video.duration,
      },
      state.projectThumbnail ? { kind: 'blob', blob: state.projectThumbnail } : null,
      false,
      null,
    );
  }
}
