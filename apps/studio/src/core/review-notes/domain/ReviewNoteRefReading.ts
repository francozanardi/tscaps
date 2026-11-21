/**
 * What a note's ref points at now: found, with the words it shows (null
 * for something with no words, such as a shot), or gone, when a reflow
 * or an edit took it away after the note was made.
 */
export type ReviewNoteRefReading =
  | { readonly status: 'found'; readonly words: string | null }
  | { readonly status: 'gone' };
