/**
 * What came of resolving one note: `resolved` (it is removed), or why
 * not — no note has that number, or the note was never sent, so nobody
 * could have worked on it.
 */
export type ReviewNoteResolution = 'resolved' | 'unknown' | 'not-sent';
