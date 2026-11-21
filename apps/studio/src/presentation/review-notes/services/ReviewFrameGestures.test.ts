import { describe, expect, it } from 'vitest';
import type { ReviewMark } from '@core/review-notes/domain/ReviewMark';
import type { ReviewPoint } from '@core/review-notes/domain/ReviewPoint';
import { ReviewFrameGestures } from '@presentation/review-notes/services/ReviewFrameGestures';
import { ReviewMarkGeometry } from '@presentation/review-notes/services/ReviewMarkGeometry';
import { ReviewMarkingStore, type ReviewTool } from '@presentation/review-notes/stores/ReviewMarkingStore';

/**
 * Presses on the frame become notes: a comment opens where it is
 * clicked, a drawing opens its note at the end of what was drawn, and
 * marks drawn one after the other belong to the same note.
 */

const FRAME = { left: 100, top: 50, width: 400, height: 200 };

function marking(tool: ReviewTool) {
  const store = new ReviewMarkingStore();
  const gestures = new ReviewFrameGestures(store, new ReviewMarkGeometry());
  const opened: Array<{ at: ReviewPoint; marks: ReadonlyArray<ReviewMark> }> = [];
  const compose = (at: ReviewPoint, marks: ReadonlyArray<ReviewMark>) => {
    opened.push({ at, marks });
    store.compose({ sourceSec: 1, at, marks, refs: [], quote: null });
  };
  store.selectTool(tool);
  const drag = (path: ReadonlyArray<[number, number]>) => {
    const [first, ...rest] = path;
    gestures.press(FRAME, first![0], first![1], compose);
    for (const [x, y] of rest) gestures.move(FRAME, x, y);
    gestures.release(compose);
  };
  return { store, gestures, opened, compose, drag };
}

describe('marking the frame', () => {
  it('opens a comment where the frame is clicked, in shares of the frame', () => {
    const { gestures, opened, compose } = marking('comment');

    const keepsPointer = gestures.press(FRAME, 200, 100, compose);

    expect(keepsPointer).toBe(false);
    expect(opened).toEqual([{ at: { x: 0.25, y: 0.25 }, marks: [] }]);
  });

  it('opens a drawn note at the end of the line, where the drag ended', () => {
    const { opened, drag } = marking('pen');

    drag([[100, 50], [300, 150], [500, 250]]);

    expect(opened).toEqual([{ at: { x: 1, y: 1 }, marks: [{ kind: 'stroke', points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }] }] }]);
  });

  it('keeps every mark drawn for the same note, and what was written so far', () => {
    const { store, opened, drag } = marking('pen');

    drag([[120, 60], [200, 100], [260, 120]]);
    store.setText('Bigger');
    drag([[300, 200], [400, 150]]);

    expect(opened[1]?.marks).toHaveLength(2);
    expect(store.snapshot().composition?.text).toBe('Bigger');
    expect(store.snapshot().composition?.at).toEqual({ x: 0.75, y: 0.5 });
  });

  it('drops a slip too small to be a drawing', () => {
    const { opened, drag } = marking('pen');

    drag([[200, 100], [201, 100]]);

    expect(opened).toEqual([]);
  });

  it('keeps a press dragged off the frame on its edge', () => {
    const { opened, drag } = marking('pen');

    drag([[300, 150], [900, -100]]);

    expect(opened[0]?.at).toEqual({ x: 1, y: 0 });
  });

  it('drops what was drawn and written when marking ends', () => {
    const { store, drag } = marking('pen');
    drag([[120, 60], [200, 100]]);

    store.stop();

    expect(store.snapshot()).toMatchObject({ active: false, composition: null, drawing: null, tool: 'pen' });
  });
});
