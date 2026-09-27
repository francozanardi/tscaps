import type { TextDirection } from '@modules/bidi/TextDirection';

/**
 * One stretch of a word that resolves to a single bidi embedding level.
 *
 * A word normally yields exactly one. A word that wraps neutral
 * characters around a run of another script yields several, and they can
 * land far apart on the line, because the algorithm places each level
 * separately.
 */
export interface WordFragment {
  /** Position of the owning word within its line, in spoken order. */
  readonly wordIndex: number;
  readonly text: string;
  /** Direction this fragment's own characters read in. */
  readonly direction: TextDirection;
  /**
   * Whether the fragment painted immediately before this one ends where
   * this one begins, with no word separator between them. Such a pair
   * reads as one uninterrupted stretch and takes no inter-word gap.
   */
  readonly joinedToPrevious: boolean;
  /**
   * Whether this fragment's characters connect to one another, so
   * painting them as separate boxes would break their shapes.
   */
  readonly charactersJoin: boolean;
  /**
   * Whether this is the last fragment of its word in paint order.
   * Anything a word appends once — a decoration glyph, trailing text —
   * belongs here, or a split word would show it on every piece.
   */
  readonly carriesWordTail: boolean;
  /**
   * Whether this fragment paints inside the stretch holding the word's
   * body. False only on a piece the algorithm placed away from the rest
   * of its word, where a decoration that points at the word would sit
   * far from the letters it names.
   */
  readonly carriesWordBody: boolean;
}
