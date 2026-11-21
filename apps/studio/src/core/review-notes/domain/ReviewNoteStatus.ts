/**
 * Where a note is in its life: a `draft` waits for the next batch; a
 * `sent` one is in a batch and waits for whoever edits the video. A note
 * that was done is no longer kept: resolving removes it.
 */
export type ReviewNoteStatus = 'draft' | 'sent';
