import type { EditorStore } from '@core/editor/store/EditorStore';
import { AddReviewNoteAction } from '@core/review-notes/actions/AddReviewNoteAction';
import { ResolveReviewNotesAction } from '@core/review-notes/actions/ResolveReviewNotesAction';
import { DeleteReviewNoteAction } from '@core/review-notes/actions/DeleteReviewNoteAction';
import { DescribeReviewNotesAction } from '@core/review-notes/actions/DescribeReviewNotesAction';
import { EditReviewNoteAction } from '@core/review-notes/actions/EditReviewNoteAction';
import { ReopenReviewNoteAction } from '@core/review-notes/actions/ReopenReviewNoteAction';
import { SubmitReviewBatchAction } from '@core/review-notes/actions/SubmitReviewBatchAction';
import type { ReviewFrames } from '@core/review-notes/domain/ReviewFrames';
import { CanvasReviewMarkPainter } from '@core/review-notes/infrastructure/CanvasReviewMarkPainter';
import { ReviewBatchChannel } from '@core/review-notes/services/ReviewBatchChannel';
import { ReviewNoteRefReader } from '@core/review-notes/services/ReviewNoteRefReader';
import { ReviewNoteTextWriter } from '@core/review-notes/services/ReviewNoteTextWriter';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

export interface ReviewNotesDependencies {
  readonly store: EditorStore;
  /** Pictures of the output frame as the export draws it. */
  readonly frames: ReviewFrames;
  readonly shotsMaterializer: ShotPartitionMaterializer;
}

export type ReviewNotesModule = ReturnType<typeof bootReviewNotes>;

/**
 * Boots review notes on every surface: the person's notes are part of
 * the project and must round-trip through a save wherever it is opened.
 * Whether the tools to make them are shown is the editor's to decide,
 * by whether anything reads the batches.
 */
export function bootReviewNotes(deps: ReviewNotesDependencies) {
  const batches = new ReviewBatchChannel();
  return {
    batches,
    actions: {
      add: new AddReviewNoteAction(deps.store),
      edit: new EditReviewNoteAction(deps.store),
      delete: new DeleteReviewNoteAction(deps.store),
      submit: new SubmitReviewBatchAction(deps.store, batches),
      resolve: new ResolveReviewNotesAction(deps.store),
      reopen: new ReopenReviewNoteAction(deps.store),
      describe: new DescribeReviewNotesAction(
        deps.store,
        deps.frames,
        new CanvasReviewMarkPainter(),
        new ReviewNoteRefReader(),
        new ReviewNoteTextWriter(),
        deps.shotsMaterializer,
      ),
    },
  };
}
