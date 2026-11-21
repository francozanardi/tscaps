import { createContext, useContext, type ReactNode } from 'react';
import type { ReviewNotesModule } from '@bootstrap/wiring/review-notes';

const ReviewNotesContext = createContext<ReviewNotesModule | null>(null);

interface ReviewNotesProviderProps {
  value: ReviewNotesModule;
  children: ReactNode;
}

export function ReviewNotesProvider({ value, children }: ReviewNotesProviderProps) {
  return <ReviewNotesContext.Provider value={value}>{children}</ReviewNotesContext.Provider>;
}

/**
 * Returns the review notes module — what makes, sends, closes and
 * describes the person's notes. Throws if mounted outside
 * `<ReviewNotesProvider>`; that is always a wiring bug and should
 * surface loudly.
 */
export function useReviewNotes(): ReviewNotesModule {
  const value = useContext(ReviewNotesContext);
  if (!value) throw new Error('useReviewNotes must be used inside <ReviewNotesProvider>');
  return value;
}
