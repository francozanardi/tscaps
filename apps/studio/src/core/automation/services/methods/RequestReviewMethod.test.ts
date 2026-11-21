import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import { RequestReviewMethod } from '@core/automation/services/methods/RequestReviewMethod';
import { AddReviewNoteAction } from '@core/review-notes/actions/AddReviewNoteAction';
import type { DescribeReviewNotesAction } from '@core/review-notes/actions/DescribeReviewNotesAction';
import { ReopenReviewNoteAction } from '@core/review-notes/actions/ReopenReviewNoteAction';
import { SubmitReviewBatchAction } from '@core/review-notes/actions/SubmitReviewBatchAction';
import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';
import { ReviewBatchChannel } from '@core/review-notes/services/ReviewBatchChannel';
import type { PictureSheetComposer } from '@core/pictures/domain/PictureSheetComposer';

/**
 * The agent asks for the person's review: the notes sent since it last
 * asked, or, with none, a wait for the next batch and then word that the
 * person is still reviewing.
 */

function reviewing() {
  const store = new EditorStore();
  const channel = new ReviewBatchChannel();
  // Notes read as their text alone, with no pictures: no note here marks a place.
  const describe = { execute: async (notes: ReadonlyArray<ReviewNote>) => ({ text: notes.map((note) => note.text).join(' | '), pictures: [] }) };
  const method = new RequestReviewMethod(
    store,
    channel,
    describe as unknown as DescribeReviewNotesAction,
    {} as PictureSheetComposer,
    new AutomationParamsReader(),
  );
  return {
    method,
    add: (text: string) => new AddReviewNoteAction(store).execute({ sourceSec: 1, place: null, refs: [], quote: null, text }),
    send: () => new SubmitReviewBatchAction(store, channel).execute(),
    reopen: (number: number) => new ReopenReviewNoteAction(store).execute(store.snapshot().reviewNotes.findByNumber(number)?.id ?? ''),
  };
}

describe('request_review', () => {
  it('answers a batch sent before it was asked, once, and then that the person is still reviewing', async () => {
    const review = reviewing();
    review.add('Bigger');
    review.send();
    review.add('Slower');

    expect(await review.method.run({ waitSec: 0 })).toEqual({ notes: [1], text: 'Bigger', pictures: [] });
    expect(await review.method.run({ waitSec: 0 })).toEqual({ reviewing: true, drafts: 1 });
  });

  it('waits for the batch the person sends, and names the notes answered before that are still open', async () => {
    const review = reviewing();
    review.add('Bigger');
    review.send();
    await review.method.run({ waitSec: 0 });

    const asked = review.method.run({ waitSec: 5 });
    review.add('Slower');
    review.send();

    expect(await asked).toEqual({ notes: [2], text: 'Slower', stillOpen: [1], pictures: [] });
  });

  it('answers a note the person sent again', async () => {
    const review = reviewing();
    review.add('Bigger');
    review.send();
    await review.method.run({ waitSec: 0 });

    review.reopen(1);
    review.send();

    expect(await review.method.run({ waitSec: 0 })).toEqual({ notes: [1], text: 'Bigger', pictures: [] });
  });
});
