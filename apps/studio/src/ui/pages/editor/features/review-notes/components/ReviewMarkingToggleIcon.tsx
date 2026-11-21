import { MessageSquarePlus, PenLine } from 'lucide-react';
import type { ReviewMarkingToggle } from '@ui/pages/editor/features/review-notes/hooks/useReviewMarkingToggle';

/** A marking toggle's icon: the tool it marks with while marking, a comment's otherwise. */
export function ReviewMarkingToggleIcon({ toggle, size }: { toggle: ReviewMarkingToggle; size: number }) {
  return toggle.tool === 'pen' ? <PenLine size={size} aria-hidden /> : <MessageSquarePlus size={size} aria-hidden />;
}
