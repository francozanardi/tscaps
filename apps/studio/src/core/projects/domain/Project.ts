import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { ProjectVideo } from '@core/projects/domain/ProjectVideo';
import { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import type { CaptionTrack } from '@core/translations/domain/CaptionTrack';
import { ReviewNoteSet } from '@core/review-notes/domain/ReviewNoteSet';

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
    readonly behindActorOverrides: BehindActorOverrideRegistry,
    readonly frozenSegments: FrozenSegmentSet,
    readonly elementStyles: ElementStyles,
    readonly decorationOverrides: DecorationOverrideRegistry,
    readonly cuts: CutRegistry,
    readonly shots: ShotPartition,
    readonly outputFrame: OutputFrame,
    readonly colorGrade: ColorGrade,
    readonly thumbnail: Blob | null,
    readonly captionTracks: ReadonlyArray<CaptionTrack> = [],
    readonly activeCaptionTrackId: string | null = null,
    /** The soundtrack. Empty for a project saved before there was one. */
    readonly audio: AudioMix = AudioMix.empty(),
    /**
     * Where the video's picture changes abruptly, in source seconds,
     * ascending; `null` where nobody looked.
     */
    readonly pictureChangesSec: ReadonlyArray<number> | null = null,
    /** The person's review notes. None for a project saved before there were any. */
    readonly reviewNotes: ReviewNoteSet = ReviewNoteSet.empty(),
  ) {}

  /** The media files the project uses: those its shots show and those its soundtrack plays. */
  mediaIdsInUse(): ReadonlySet<string> {
    return new Set([...this.shots.mediaIdsInUse(), ...this.audio.mediaIdsInUse()]);
  }

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
      this.shots,
      this.outputFrame,
      this.colorGrade,
      this.thumbnail,
      this.captionTracks.map((track) =>
        track.id === this.activeCaptionTrackId ? track.with({ sheets }) : track,
      ),
      this.activeCaptionTrackId,
      this.audio,
      this.pictureChangesSec,
      this.reviewNotes,
    );
  }

  /** The caption track being edited, or `null` for a project saved before tracks existed. */
  activeCaptionTrack(): CaptionTrack | null {
    return this.captionTracks.find((track) => track.id === this.activeCaptionTrackId) ?? null;
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
      this.shots,
      this.outputFrame,
      this.colorGrade,
      this.thumbnail,
      captionTracks,
      this.activeCaptionTrackId,
      this.audio,
      this.pictureChangesSec,
      this.reviewNotes,
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
      BehindActorOverrideRegistry.empty(),
      FrozenSegmentSet.empty(),
      ElementStyles.empty(),
      DecorationOverrideRegistry.empty(),
      CutRegistry.empty(),
      ShotPartition.empty(),
      OutputFrame.original(),
      ColorGrade.neutral(),
      null,
    );
  }
}
