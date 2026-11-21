import type { Document } from '@tscaps/engine';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';

/** Everything a proposal is read from. */
export interface ShotProposalInputs {
  readonly document: Document | null;
  readonly videoDurationSec: number;
  readonly sheets: ReadonlyArray<Sheet>;
  /** Where the source's picture changes abruptly; null where nobody looked. */
  readonly pictureChangesSec: ReadonlyArray<number> | null;
  /** What is cut out of the video: the proposal is of what plays. */
  readonly cuts: CutRegistry;
}

/**
 * The partition an edit is about to change: the stored one, or the
 * proposal turned real where nothing is stored yet.
 *
 * Materialising on the first edit is what stops a transcript change
 * from ever moving a shot somebody decided on. Until then there is
 * nothing to lose, and nothing can be attached to a proposed shot.
 */
export class ShotPartitionMaterializer {
  constructor(
    private readonly partitioner: ShotPartitioner,
    private readonly originalCaptions: OriginalCaptionTrackReader,
  ) {}

  materialize(stored: ShotPartition, inputs: ShotProposalInputs): ShotPartition {
    if (!stored.isEmpty()) return stored;
    return stored.withProposal(
      this.partitioner.propose(
        inputs.document,
        inputs.videoDurationSec,
        inputs.sheets,
        stored.budget(),
        inputs.pictureChangesSec ?? [],
        inputs.cuts,
      ),
    );
  }

  /**
   * The partition an edit on this state is about to change. A proposal
   * is read off the Original track's words whatever caption track is
   * active: shots are about the video, not the captions.
   */
  materializeFrom(state: EditorState): ShotPartition {
    const { document, sheets } = this.originalCaptions.read(state);
    return this.materialize(state.shots, {
      document,
      videoDurationSec: state.video.duration,
      sheets,
      pictureChangesSec: state.video.pictureChangesSec,
      cuts: state.cuts,
    });
  }
}
