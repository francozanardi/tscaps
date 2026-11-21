import type { ReactNode } from 'react';
import { MessageSquarePlus, PenLine } from 'lucide-react';
import type { ReviewTool } from '@presentation/review-notes/stores/ReviewMarkingStore';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { REVIEW_FLOATING, REVIEW_ICON_BUTTON, REVIEW_ICON_BUTTON_ACTIVE } from '@ui/pages/editor/features/review-notes/review-notes-classes';

interface ReviewToolStripProps {
  /** The tool picked, or null while nothing is being marked. */
  tool: ReviewTool | null;
  /** Picks `tool`, or puts it down when it is the one picked. */
  onToolPress: (tool: ReviewTool) => void;
  /** Whether marking starts from outside the frame, so the strip shows only while the tools are offered. */
  byTouch: boolean;
  /** Whether the tools are offered, none picked yet. */
  choosing: boolean;
}

const TOOLS: ReadonlyArray<{ tool: ReviewTool; label: string; icon: ReactNode }> = [
  { tool: 'comment', label: 'Comment on what you click', icon: <MessageSquarePlus size={16} aria-hidden /> },
  { tool: 'pen', label: 'Draw', icon: <PenLine size={16} aria-hidden /> },
];

// Out of the way of the video: unseen until the pointer is over the frame, faint there, whole once it is over the
// strip, and whole for as long as a tool is picked or the strip has the keyboard's focus.
const RESTING = 'opacity-0 [@media(hover:hover)]:group-hover/frame:opacity-60 hover:!opacity-100 focus-within:!opacity-100';
const PICKED = 'opacity-100';

/**
 * The marking tools at the top of the frame. Pressing one marks with it;
 * pressing the one picked puts it down and leaves marking. Found on hover;
 * `byTouch`, where nothing hovers, it is there only while the tools are
 * offered, and goes once one is picked, leaving the frame to mark on.
 */
export function ReviewToolStrip({ tool, onToolPress, byTouch, choosing }: ReviewToolStripProps) {
  if (byTouch && !choosing) return null;
  return (
    <div
      role="toolbar"
      aria-label="Mark what to change"
      className={`${REVIEW_FLOATING} ${tool === null && !choosing ? RESTING : PICKED} absolute z-30 top-2 left-1/2 -translate-x-1/2 `
        + 'flex items-center gap-1 p-1 pointer-events-auto transition-opacity duration-quick ease-standard'}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {TOOLS.map((each) => (
        <Tooltip key={each.tool} text={each.tool === tool ? `${each.label} (on; press to stop marking)` : each.label}>
          <button
            type="button"
            className={each.tool === tool ? REVIEW_ICON_BUTTON_ACTIVE : REVIEW_ICON_BUTTON}
            onClick={() => onToolPress(each.tool)}
            aria-label={each.label}
            aria-pressed={each.tool === tool}
          >
            {each.icon}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
