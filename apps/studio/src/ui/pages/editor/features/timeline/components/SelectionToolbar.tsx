import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Scissors, X } from 'lucide-react';
import type { TimelineSelection } from '@presentation/timeline/controllers/TimelineEditingController';
import { useShortcutLabel } from '@ui/_shared/hooks/useShortcutLabel';

// Same paper as the popovers — surface, border and radius all match
// theirs. The shape is where they differ, and that difference is
// load-bearing: this one is a bar that survives a press elsewhere and
// says so by carrying Cancel; a popover dismisses itself.
const TOOLBAR_CLASS =
  'pointer-events-auto absolute z-20 flex items-center gap-1.5 px-1.5 py-1 rounded-sm shadow-md ' +
  'bg-surface-2 border border-edge-subtle text-2xs font-sans normal-case tracking-normal whitespace-nowrap';

const BUTTON_CLASS =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-xs border border-edge-medium bg-surface-3 ' +
  'text-2xs font-medium text-fg-primary ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-2 hover:border-accent ' +
  'focus-visible:outline-none focus-visible:border-accent';

const DANGER_BUTTON_CLASS =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-xs border border-danger/40 bg-danger/15 ' +
  'text-2xs font-medium text-danger ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'hover:bg-danger/25 hover:border-danger ' +
  'focus-visible:outline-none focus-visible:border-danger';

const SHORTCUT_HINT_CLASS = 'font-mono text-[10px] leading-none opacity-60';

// Breathing room between the toolbar and whatever it sits against, be
// that the anchor row or the edge of the panel.
const TOOLBAR_GAP_PX = 4;

interface SelectionToolbarProps {
  selection: TimelineSelection;
  /** Top of the anchor row, in pixels down the timeline's own box. */
  anchorTopPx: number;
  /** Bottom of the anchor row, in the same coordinates. */
  anchorBottomPx: number;
  /** The focus edge's horizontal position, as 0..1 of the timeline's width. */
  focusFraction: number;
  scrollElement: HTMLElement | null;
  onCut: () => void;
  onCancel: () => void;
}

/**
 * Actions for the current selection, floating next to the edge the user
 * last moved so they land where the pointer already is.
 *
 * It is where cutting is offered, rather than on the thing being cut: a
 * word is as wide as it is long, and at a tenth of a second that is
 * narrower than any button that could sit inside it.
 *
 * It must be drawn by the timeline rather than by the row holding that
 * edge. A selection can easily cover more rows than fit on screen, and
 * the virtualizer does not even mount the far ones; whenever its anchor
 * is out of view the toolbar pins to the bottom of the panel instead,
 * so Cancel and Cut are never more than one press away.
 *
 * Horizontally it is centred on the moved edge and then pushed back
 * inside the panel, so a narrow panel never cuts it in half.
 *
 * The position is written straight to the node rather than held in
 * state: it depends on measurements that only exist after layout, and a
 * render pass per measurement would show the toolbar in the wrong place
 * first. Vertical room is judged from the anchor row and the toolbar's
 * own height, never from the placed toolbar's rect — measuring the
 * result of the current placement makes the two sides flip each other
 * forever when neither has room.
 */
export function SelectionToolbar({
  selection,
  anchorTopPx,
  anchorBottomPx,
  focusFraction,
  scrollElement,
  onCut,
  onCancel,
}: SelectionToolbarProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Cutting one thing at a time is repetitive work, and reaching for this
  // button every time is the slow way to do it. Printing the key here is
  // what makes the fast path exist for anyone who never opens the list.
  const cutShortcutLabel = useShortcutLabel('timeline.cut');

  const place = useCallback(() => {
    const toolbar = ref.current;
    const timeline = toolbar?.offsetParent;
    if (!toolbar || !timeline || !scrollElement) return;
    const timelineRect = timeline.getBoundingClientRect();
    const view = scrollElement.getBoundingClientRect();
    const { offsetHeight: heightPx, offsetWidth: widthPx } = toolbar;

    const anchorTopClient = timelineRect.top + anchorTopPx;
    const anchorBottomClient = timelineRect.top + anchorBottomPx;
    const anchorInView = anchorBottomClient > view.top && anchorTopClient < view.bottom;
    if (anchorInView) {
      const fitsBelow = view.bottom - anchorBottomClient >= heightPx + TOOLBAR_GAP_PX;
      toolbar.style.top = fitsBelow
        ? `${anchorBottomPx + TOOLBAR_GAP_PX}px`
        : `${anchorTopPx - TOOLBAR_GAP_PX - heightPx}px`;
    } else {
      toolbar.style.top = `${view.bottom - TOOLBAR_GAP_PX - heightPx - timelineRect.top}px`;
    }

    // Centred on the moved edge, then pushed back inside the panel. The
    // panel's own rect is what it is clamped against rather than the
    // timeline's, so the toolbar may use the padding around the rows.
    const focusClientX = timelineRect.left + focusFraction * timelineRect.width;
    const earliestLeft = view.left + TOOLBAR_GAP_PX;
    const latestLeft = view.right - TOOLBAR_GAP_PX - widthPx;
    const leftClient = Math.max(earliestLeft, Math.min(focusClientX - widthPx / 2, latestLeft));
    toolbar.style.left = `${leftClient - timelineRect.left}px`;
  }, [anchorTopPx, anchorBottomPx, focusFraction, scrollElement]);

  useLayoutEffect(place);

  useEffect(() => {
    if (!scrollElement) return;
    scrollElement.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      scrollElement.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, [scrollElement, place]);

  const duration = selection.endSec - selection.startSec;

  return (
    <div
      ref={ref}
      className={TOOLBAR_CLASS}
      style={{ top: anchorBottomPx + TOOLBAR_GAP_PX, left: 0 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="text-fg-muted">Selection {duration.toFixed(2)}s</span>
      <button type="button" className={BUTTON_CLASS} onClick={onCancel}>
        <X size={12} />
        <span>Cancel</span>
      </button>
      <button type="button" className={DANGER_BUTTON_CLASS} onClick={onCut}>
        <Scissors size={12} />
        <span>Cut</span>
        {cutShortcutLabel && <kbd className={SHORTCUT_HINT_CLASS}>{cutShortcutLabel}</kbd>}
      </button>
    </div>
  );
}
