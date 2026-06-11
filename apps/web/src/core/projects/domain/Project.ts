import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { ProjectVideo } from '@core/projects/domain/ProjectVideo';
import { WordStyleOverrideRegistry } from '@core/editor/domain/WordStyleOverrideRegistry';
import { SegmentOverrides } from '@core/editor/domain/SegmentOverrides';

/**
 * A persisted unit of editor work. Owns the document (transcription + edits),
 * the sheets that style it, and metadata about the source video.
 *
 * The actual video Blob is cached separately keyed by project id under an
 * LRU policy. When the cache has evicted a project's video, this Project
 * still loads — the dashboard prompts the user to re-select the source file.
 *
 * Project is a passive value class: actions assemble fresh instances from
 * editor state when saving, and the serializer rebuilds them when loading.
 * Mutations live in EditorStore, not here.
 */
export class Project {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly video: ProjectVideo,
    readonly videoLayout: VideoLayout | null,
    readonly document: Document | null,
    readonly sheets: ReadonlyArray<Sheet>,
    readonly activeSheetId: string | null,
    readonly wordStyleOverrides: WordStyleOverrideRegistry,
    readonly segmentOverrides: SegmentOverrides,
    readonly thumbnail: Blob | null,
  ) {}

  /**
   * Builds a fresh Project for a newly imported video. Document and sheets
   * are empty; the caller fills them in once transcription completes and
   * sheets are initialised.
   */
  static fromVideo(name: string, video: ProjectVideo): Project {
    const now = new Date();
    return new Project(
      crypto.randomUUID(),
      name,
      now,
      now,
      video,
      null,
      null,
      [],
      null,
      WordStyleOverrideRegistry.empty(),
      SegmentOverrides.empty(),
      null,
    );
  }
}
