import { z } from 'zod';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PictureSheetComposer } from '@core/pictures/domain/PictureSheetComposer';
import type { DescribeReviewNotesAction } from '@core/review-notes/actions/DescribeReviewNotesAction';
import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';
import type { ReviewNotePicture } from '@core/review-notes/domain/ReviewNotesReading';
import type { ReviewBatchChannel } from '@core/review-notes/services/ReviewBatchChannel';

const MAX_WAIT_SEC = 25;
const PARAMS = z.object({ waitSec: z.number().min(0).max(MAX_WAIT_SEC).default(MAX_WAIT_SEC) });

// The size a moment's picture is shown at: the marks and the captions under them stay readable.
const SHEET = { maxWidthPx: 1280, maxHeightPx: 960 };

/**
 * `request_review`: the notes the person sent to the agent since it last
 * asked, read as the in-app assistant reads them (what each asks, where
 * and when, what is under it) with one picture per moment a note marks,
 * the marks painted over the frame as the export draws it. With nothing
 * new sent, it waits for the person's next batch up to `waitSec`, and
 * answers that they are still reviewing, with how many notes they have
 * written and not sent.
 *
 * A batch sent while nobody asked is kept: the notes stay sent in the
 * project, and the next call answers them. A note sent again is answered
 * again. What was answered is kept in memory only, so a reloaded page
 * answers its sent notes once more.
 */
export class RequestReviewMethod implements AutomationMethod {
  readonly name = 'request_review';
  private readonly answered = new Set<string>();

  constructor(
    private readonly store: EditorStore,
    private readonly batches: ReviewBatchChannel,
    private readonly describe: DescribeReviewNotesAction,
    private readonly composer: PictureSheetComposer,
    private readonly params: AutomationParamsReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { waitSec } = this.params.read(this.name, PARAMS, params);
    let notes = this.unanswered();
    if (notes.length === 0) {
      await this.nextBatch(waitSec * 1000);
      notes = this.unanswered();
    }
    if (notes.length === 0) return { reviewing: true, drafts: this.store.snapshot().reviewNotes.drafts().length };
    const answer = await this.answerOf(notes);
    for (const note of notes) this.answered.add(this.sendingOf(note));
    return answer;
  }

  /** The sent notes not answered yet, in the order they were made. */
  private unanswered(): ReadonlyArray<ReviewNote> {
    return this.store.snapshot().reviewNotes.list().filter((note) => note.status === 'sent' && !this.answered.has(this.sendingOf(note)));
  }

  /** One sending of `note`: a note sent again, in another batch, is another sending. */
  private sendingOf(note: ReviewNote): string {
    return `${note.id}:${note.batchId ?? ''}`;
  }

  /** Resolves when the person sends a batch, or after `waitMs`. */
  private nextBatch(waitMs: number): Promise<void> {
    return new Promise((resolve) => {
      // Called only once the timer or the channel fires, by when both below are set.
      const done = (): void => {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      };
      const timer = setTimeout(done, waitMs);
      const unsubscribe = this.batches.subscribe(done);
    });
  }

  private async answerOf(notes: ReadonlyArray<ReviewNote>): Promise<Record<string, unknown>> {
    const reading = await this.describe.execute(notes, new AbortController().signal);
    try {
      const pictures = [];
      for (const picture of reading.pictures) pictures.push(await this.pictureOf(picture));
      const earlier = this.store.snapshot().reviewNotes.list()
        .filter((note) => note.status === 'sent' && this.answered.has(this.sendingOf(note)))
        .map((note) => note.number);
      return {
        notes: notes.map((note) => note.number),
        text: reading.text,
        ...(earlier.length > 0 ? { stillOpen: earlier } : {}),
        pictures,
      };
    } finally {
      for (const picture of reading.pictures) picture.bitmap.close();
    }
  }

  private async pictureOf(picture: ReviewNotePicture): Promise<{ mediaType: string; base64: string }> {
    const label = `${picture.numbers.length === 1 ? 'Note' : 'Notes'} ${picture.numbers.join(', ')} · ${picture.sourceSec.toFixed(2)} s`;
    const sheet = await this.composer.sheet([{ bitmap: picture.bitmap, label }], { ...SHEET, region: null, backdrop: 'none' });
    return { mediaType: sheet.mediaType, base64: sheet.base64 };
  }
}
