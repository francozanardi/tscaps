import { useEffect, type RefObject } from 'react';
import type { BottomSheetResizeController } from '@presentation/editor/controllers/BottomSheetResizeController';
import { SheetContentResizeReader } from '@presentation/editor/services/SheetContentResizeReader';

const reader = new SheetContentResizeReader();

/**
 * Lets a drag on the sheet's own content resize it, where the content has no
 * use for that drag (see `SheetContentResizeReader`). Listens to touch events
 * rather than pointer events: the browser's scrolling can only be stopped from
 * a `touchmove` listener that is not passive, which React's own are.
 * `containerHeightPx` is read when a touch lands.
 */
export function useSheetContentResize(
  sheetRef: RefObject<HTMLElement | null>,
  controller: BottomSheetResizeController,
  containerHeightPx: () => number,
): void {
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      // A second finger is a pinch, not a resize: drop whatever the first one started.
      const resize = event.touches.length === 1 && event.target instanceof Element ? reader.resizeAt(event.target, sheet) : 'none';
      if (touch) controller.startContentTouchGesture(touch.identifier, touch.clientX, touch.clientY, containerHeightPx(), resize);
    };
    const onTouchMove = (event: TouchEvent) => {
      for (const touch of event.changedTouches) {
        if (controller.extendContentTouchGesture(touch.identifier, touch.clientX, touch.clientY) && event.cancelable) event.preventDefault();
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      for (const touch of event.changedTouches) controller.endContentTouchGesture(touch.identifier);
    };
    sheet.addEventListener('touchstart', onTouchStart, { passive: true });
    sheet.addEventListener('touchmove', onTouchMove, { passive: false });
    sheet.addEventListener('touchend', onTouchEnd);
    sheet.addEventListener('touchcancel', onTouchEnd);
    return () => {
      sheet.removeEventListener('touchstart', onTouchStart);
      sheet.removeEventListener('touchmove', onTouchMove);
      sheet.removeEventListener('touchend', onTouchEnd);
      sheet.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [sheetRef, controller, containerHeightPx]);
}
