/**
 * The level the timeline is read at: each word on its own, or each scene
 * as one block. Each level has one kind of thing to take hold of, so a
 * drag always means the same thing within it.
 */
export type TimelineView = 'words' | 'scenes';

export const TIMELINE_VIEWS: ReadonlyArray<TimelineView> = ['words', 'scenes'];

/**
 * What a reader who has never picked a level meets. The timeline opens to
 * read the transcript against the clock, and words are what that reading
 * is made of.
 */
export const DEFAULT_TIMELINE_VIEW: TimelineView = 'words';
