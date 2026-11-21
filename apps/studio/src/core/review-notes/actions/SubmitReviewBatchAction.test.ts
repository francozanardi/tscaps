import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { AddReviewNoteAction } from '@core/review-notes/actions/AddReviewNoteAction';
import { ResolveReviewNotesAction } from '@core/review-notes/actions/ResolveReviewNotesAction';
import { DeleteReviewNoteAction } from '@core/review-notes/actions/DeleteReviewNoteAction';
import { EditReviewNoteAction } from '@core/review-notes/actions/EditReviewNoteAction';
import { ReopenReviewNoteAction } from '@core/review-notes/actions/ReopenReviewNoteAction';
import { SubmitReviewBatchAction } from '@core/review-notes/actions/SubmitReviewBatchAction';
import type { ReviewBatch } from '@core/review-notes/domain/ReviewBatch';
import { ReviewBatchChannel } from '@core/review-notes/services/ReviewBatchChannel';

/**
 * Notes are drafts until a batch sends every one of them at once, the
 * way a review is submitted; whoever edits resolves the ones done, which
 * removes them, and the person can send a sent one again. Making,
 * changing and resolving notes are steps of the edit history.
 */

function reviewing() {
  const store = new EditorStore();
  const channel = new ReviewBatchChannel();
  const heard: ReviewBatch[] = [];
  channel.subscribe((batch) => heard.push(batch));
  return {
    store,
    heard,
    add: (text: string, sourceSec = 1) => new AddReviewNoteAction(store).execute({ sourceSec, place: null, refs: [], quote: null, text }),
    submit: new SubmitReviewBatchAction(store, channel),
    resolve: new ResolveReviewNotesAction(store),
    reopen: new ReopenReviewNoteAction(store),
    edit: new EditReviewNoteAction(store),
    remove: new DeleteReviewNoteAction(store),
    statuses: () => store.snapshot().reviewNotes.list().map((note) => `${note.number}:${note.status}`),
  };
}

describe('sending a batch', () => {
  it('sends every draft under one batch and tells whoever listens', () => {
    const review = reviewing();
    review.add('Bigger');
    review.add('Slower', 2);

    const batch = review.submit.execute();

    expect(batch?.notes.map((note) => note.number)).toEqual([1, 2]);
    expect(review.heard).toEqual([batch]);
    expect(review.statuses()).toEqual(['1:sent', '2:sent']);
    expect(new Set(review.store.snapshot().reviewNotes.list().map((note) => note.batchId))).toEqual(new Set([batch?.id]));
  });

  it('sends nothing, and tells nobody, when there is no draft', () => {
    const review = reviewing();
    review.add('Bigger');
    review.submit.execute();

    expect(review.submit.execute()).toBeNull();
    expect(review.heard).toHaveLength(1);
  });

  it('leaves only the notes made since in the next batch', () => {
    const review = reviewing();
    review.add('Bigger');
    review.submit.execute();
    review.add('Slower');

    expect(review.submit.execute()?.notes.map((note) => note.number)).toEqual([2]);
  });
});

describe('a note', () => {
  it('is not kept when it says nothing', () => {
    const review = reviewing();

    expect(review.add('   ')).toBeNull();
    expect(review.store.snapshot().reviewNotes.isEmpty()).toBe(true);
  });

  it('is unsaved work, and a step of undo', () => {
    const review = reviewing();
    review.add('Bigger');

    expect(review.store.snapshot().dirty).toBe(true);
    expect(review.store.snapshot().canUndo).toBe(true);
  });

  it('can be rewritten while a draft, and deleted whether sent or not', () => {
    const review = reviewing();
    const kept = review.add('Bigger')!;
    const dropped = review.add('Never mind')!;

    expect(review.edit.execute(kept.id, 'Much bigger')).toBe(true);
    expect(review.remove.execute(dropped.id)).toBe(true);
    review.submit.execute();

    expect(review.edit.execute(kept.id, 'Smaller')).toBe(false);
    expect(review.store.snapshot().reviewNotes.list().map((note) => note.text)).toEqual(['Much bigger']);
    expect(review.remove.execute(kept.id)).toBe(true);
    expect(review.store.snapshot().reviewNotes.isEmpty()).toBe(true);
  });

  it('keeps no more than its longest text', () => {
    const review = reviewing();

    expect(review.add('x'.repeat(800))?.text).toHaveLength(500);
  });

  it('never takes a number a sent note had, even after drafts are dropped', () => {
    const review = reviewing();
    review.add('Bigger');
    review.submit.execute();
    const draft = review.add('Never mind')!;
    review.remove.execute(draft.id);

    expect(review.add('Slower')?.number).toBe(2);
  });
});

describe('resolving and sending again', () => {
  it('removes the sent notes that were done, and refuses a draft or a number nobody has', () => {
    const review = reviewing();
    review.add('Bigger');
    review.add('Slower');
    review.submit.execute();
    review.add('Not sent yet');

    const results = review.resolve.execute([1, 3, 9]);

    expect(results).toEqual(['resolved', 'not-sent', 'unknown']);
    expect(review.statuses()).toEqual(['2:sent', '3:draft']);
  });

  it('puts a sent note back as a draft that goes with the next batch, and leaves a draft as it is', () => {
    const review = reviewing();
    const sent = review.add('Bigger')!;
    review.submit.execute();
    const draft = review.add('Slower')!;

    expect(review.reopen.execute(sent.id)).toBe(true);
    expect(review.reopen.execute(draft.id)).toBe(false);
    expect(review.submit.execute()?.notes.map((note) => note.number)).toEqual([1, 2]);
  });
});

describe('the edit history', () => {
  it('takes back adding, rewriting and deleting a note, one step each', () => {
    const review = reviewing();
    const kept = review.add('Bigger')!;
    const dropped = review.add('Never mind')!;
    review.edit.execute(kept.id, 'Much bigger');
    review.remove.execute(dropped.id);

    review.store.undo();
    expect(review.store.snapshot().reviewNotes.list().map((note) => note.text)).toEqual(['Much bigger', 'Never mind']);
    review.store.undo();
    expect(review.store.snapshot().reviewNotes.list().map((note) => note.text)).toEqual(['Bigger', 'Never mind']);
    review.store.undo();
    review.store.undo();
    expect(review.store.snapshot().reviewNotes.isEmpty()).toBe(true);
    review.store.redo();
    expect(review.store.snapshot().reviewNotes.list().map((note) => note.text)).toEqual(['Bigger']);
  });

  it('keeps notes sent when a later step is taken back', () => {
    const review = reviewing();
    review.add('Bigger');
    review.submit.execute();
    review.add('Slower');

    review.store.undo();

    expect(review.statuses()).toEqual(['1:sent']);
  });

  it('brings resolved notes back when resolving them is taken back', () => {
    const review = reviewing();
    review.add('Bigger');
    review.submit.execute();
    review.resolve.execute([1]);

    review.store.undo();

    expect(review.statuses()).toEqual(['1:sent']);
  });
});
