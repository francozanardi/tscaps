import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { ProjectVideo } from '@core/projects/domain/ProjectVideo';
import { BehindActorSegmentOverrideRegistry } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { CaptionTrack } from '@core/translations/domain/CaptionTrack';

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
    readonly behindActorOverrides: BehindActorSegmentOverrideRegistry,
    readonly frozenSegments: FrozenSegmentSet,
    readonly elementStyles: ElementStyles,
    readonly decorationOverrides: DecorationOverrideRegistry,
    readonly cuts: CutRegistry,
    readonly thumbnail: Blob | null,
    readonly captionTracks: ReadonlyArray<CaptionTrack> = [],
    readonly activeCaptionTrackId: string | null = null,
  ) {}

  /**
   * Copy of this project carrying different sheets. Everything else,
   * including the document those sheets style, comes over untouched.
   */
  withSheets(sheets: ReadonlyArray<Sheet>): Project {
    return new Project(
      this.id,
      this.name,
      this.createdAt,
      this.updatedAt,
      this.video,
      this.videoLayout,
      this.document,
      sheets,
      this.activeSheetId,
      this.behindActorOverrides,
      this.frozenSegments,
      this.elementStyles,
      this.decorationOverrides,
      this.cuts,
      this.thumbnail,
      this.captionTracks.map((track) =>
        track.id === this.activeCaptionTrackId ? track.with({ sheets }) : track,
      ),
      this.activeCaptionTrackId,
    );
  }

  /** Copy carrying a replaced set of independently editable caption tracks. */
  withCaptionTracks(captionTracks: ReadonlyArray<CaptionTrack>): Project {
    const active = captionTracks.find((track) => track.id === this.activeCaptionTrackId) ?? null;
    return new Project(
      this.id,
      this.name,
      this.createdAt,
      this.updatedAt,
      this.video,
      this.videoLayout,
      active?.document ?? this.document,
      active?.sheets ?? this.sheets,
      active?.activeSheetId ?? this.activeSheetId,
      active?.behindActorOverrides ?? this.behindActorOverrides,
      active?.frozenSegments ?? this.frozenSegments,
      active?.elementStyles ?? this.elementStyles,
      active?.decorationOverrides ?? this.decorationOverrides,
      this.cuts,
      this.thumbnail,
      captionTracks,
      this.activeCaptionTrackId,
    );
  }

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
      BehindActorSegmentOverrideRegistry.empty(),
      FrozenSegmentSet.empty(),
      ElementStyles.empty(),
      DecorationOverrideRegistry.empty(),
      CutRegistry.empty(),
      null,
    );
  }
}
