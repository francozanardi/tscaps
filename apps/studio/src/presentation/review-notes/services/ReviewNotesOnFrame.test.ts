import { describe, expect, it } from 'vitest';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';
import { ReviewNoteSet } from '@core/review-notes/domain/ReviewNoteSet';
import { ReviewNotesOnFrame } from '@presentation/review-notes/services/ReviewNotesOnFrame';

/** Where notes show: on the frame near the playhead, and as marks along the export on the scrubber. */

const onFrame = new ReviewNotesOnFrame();

function notesAt(...moments: ReadonlyArray<[number, ReviewNote['status']]>): ReviewNoteSet {
  return ReviewNoteSet.fromSnapshot(moments.map(([sourceSec, status], index) => ({
    id: `n${index + 1}`, number: index + 1, createdAt: '2026-11-13T00:00:00Z', sourceSec, place: null, refs: [], quote: null,
    text: 'Change it', status, batchId: status === 'draft' ? null : 'b',
  })));
}

describe('notes on the frame', () => {
  it('shows the notes at the playhead\'s moment or a few frames from it, and no other', () => {
    const notes = notesAt([2, 'draft'], [2.1, 'sent'], [2.5, 'draft'], [8, 'sent']);

    expect(onFrame.shownAt(notes, 2.05).map((note) => note.number)).toEqual([1, 2]);
    expect(onFrame.shownAt(notes, 5).map((note) => note.number)).toEqual([]);
  });
});

describe('notes on the scrubber', () => {
  it('places each note along the export, with the cuts taken out', () => {
    const notes = notesAt([2, 'draft'], [8, 'sent']);
    const cuts = CutRegistry.empty().add({ startSec: 4, endSec: 6 });

    const marks = onFrame.timelineMarks(notes, cuts, 10);

    expect(marks.map((mark) => [mark.notes.map((note) => note.number), mark.share])).toEqual([[[1], 0.25], [[2], 0.75]]);
  });

  it('puts notes too close to tell apart on one mark, opening the first made', () => {
    const notes = notesAt([5.03, 'draft'], [5, 'draft'], [5.02, 'sent']);

    const marks = onFrame.timelineMarks(notes, CutRegistry.empty(), 10);

    expect(marks.map((mark) => mark.notes.map((note) => note.number))).toEqual([[1, 2, 3]]);
  });
});
