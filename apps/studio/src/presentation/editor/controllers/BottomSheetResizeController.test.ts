import { describe, expect, it } from 'vitest';
import { BottomSheetResizeController } from '@presentation/editor/controllers/BottomSheetResizeController';
import type { SheetContentResize } from '@presentation/editor/services/SheetContentResizeReader';

const CONTAINER_PX = 1000;

/** Lands a touch at y 500 on content that allows `resize`, then moves it through `moves` ([dx, dy] from where it landed). */
function dragContent(controller: BottomSheetResizeController, resize: SheetContentResize, moves: ReadonlyArray<[number, number]>): boolean[] {
  controller.startContentTouchGesture(1, 200, 500, CONTAINER_PX, resize);
  return moves.map(([dx, dy]) => controller.extendContentTouchGesture(1, 200 + dx, 500 + dy));
}

describe('BottomSheetResizeController, dragged on its content', () => {
  it('grows and shrinks with a vertical drag where nothing scrolls, and snaps when let go', () => {
    const controller = new BottomSheetResizeController();
    const taken = dragContent(controller, 'both', [[0, -4], [0, -250]]);
    expect(taken).toEqual([true, true]);
    expect(controller.pct).toBeCloseTo(0.85);
    expect(controller.isDragging).toBe(true);
    controller.endContentTouchGesture(1);
    expect(controller.pct).toBe(0.9);
    expect(controller.isDragging).toBe(false);
  });

  it('leaves a sideways drag to the content for the whole touch', () => {
    const controller = new BottomSheetResizeController();
    const taken = dragContent(controller, 'both', [[5, 1], [5, -300]]);
    expect(taken).toEqual([false, false]);
    expect(controller.pct).toBe(0.6);
  });

  it('shrinks with a pull down over a list at its top, and never grows past where the drag started', () => {
    const controller = new BottomSheetResizeController();
    expect(dragContent(controller, 'shrink', [[0, 3], [0, 200]])).toEqual([true, true]);
    expect(controller.pct).toBeCloseTo(0.4);
    controller.extendContentTouchGesture(1, 200, 100);
    expect(controller.pct).toBe(0.6);
    controller.extendContentTouchGesture(1, 200, 760);
    controller.endContentTouchGesture(1);
    expect(controller.pct).toBe(0.3);
  });

  it('leaves a push up over a list at its top to the list, which scrolls', () => {
    const controller = new BottomSheetResizeController();
    const taken = dragContent(controller, 'shrink', [[0, -3], [0, -300], [0, 200]]);
    expect(taken).toEqual([false, false, false]);
    expect(controller.pct).toBe(0.6);
  });

  it('takes nothing where the content keeps the drag', () => {
    const controller = new BottomSheetResizeController();
    const taken = dragContent(controller, 'none', [[0, 10], [0, 300]]);
    expect(taken).toEqual([false, false]);
    expect(controller.pct).toBe(0.6);
  });

  it('waits for a move that goes somewhere before deciding', () => {
    const controller = new BottomSheetResizeController();
    const taken = dragContent(controller, 'shrink', [[0, 0], [0, 100]]);
    expect(taken).toEqual([false, true]);
    expect(controller.pct).toBeCloseTo(0.5);
  });
});
