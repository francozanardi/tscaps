import { ELEMENT_KINDS } from '@core/elements/domain/ElementKind';

/** What a note can have been made over: a caption node, a shot's layer, or the shot itself. */
export const REVIEW_NOTE_REF_KINDS = [...ELEMENT_KINDS, 'shot'] as const;

export type ReviewNoteRefKind = typeof REVIEW_NOTE_REF_KINDS[number];

/**
 * One thing that was under a note when it was made, by the editor's own
 * id; written `kind:id` wherever it travels as text. A hint about what
 * the note is about, never what holds it in place: a segment can be
 * dissolved by a reflow, and the note stays on its moment and place.
 */
export interface ReviewNoteRef {
  readonly kind: ReviewNoteRefKind;
  readonly id: string;
}
