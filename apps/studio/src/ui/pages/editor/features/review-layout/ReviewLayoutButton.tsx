import { memo } from 'react';
import { MessageSquareText } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { TOOLBAR_ICON_BUTTON } from '@ui/pages/editor/components/toolbar-buttons';

interface ReviewLayoutButtonProps {
  onClick: () => void;
}

/** In the full editor of a page an agent drives, where the assistant's toggle would be: the way back to the review. */
export const ReviewLayoutButton = memo(function ReviewLayoutButton({ onClick }: ReviewLayoutButtonProps) {
  return (
    <Tooltip text="Back to the review: the video, your notes for the agent, the transcript" position="bottom">
      <button type="button" className={TOOLBAR_ICON_BUTTON} onClick={onClick} aria-label="Back to the review" data-review-layout>
        <MessageSquareText size={16} />
      </button>
    </Tooltip>
  );
});
