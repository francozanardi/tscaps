import type { ProjectThumbnailSource } from '@core/projects/domain/ProjectThumbnailSource';
import type { ProjectVideo } from '@core/projects/domain/ProjectVideo';

/**
 * Lightweight projection of a Project for dashboard listings.
 * Excludes the heavy payload (document, sheets, layout) so the
 * projects page can render many entries without paying the full
 * deserialisation cost. `hasDocument` is a derived flag the dashboard
 * uses to decide whether to label a project as "ready to open" or
 * "transcription pending".
 */
export class ProjectMetadata {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly video: ProjectVideo,
    readonly thumbnail: ProjectThumbnailSource | null,
    readonly hasDocument: boolean,
  ) {}
}
