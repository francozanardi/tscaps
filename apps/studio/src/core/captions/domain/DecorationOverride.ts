/**
 * Per-decoration override stored against a decoration id. Combines two
 * layers: actual glyph customization (`glyph`) and provenance metadata
 * (`source`, `removed`) used to decide whether the decoration survives
 * when the emoji effect is toggled off. Absent fields leave the
 * decoration driven by the document's stored value.
 *
 * Decorations created by transcription carry no entry here — their
 * effective source is implicitly AI. Anything the user adds, edits, or
 * deletes leaves a trace in this record.
 */
export interface DecorationOverride {
  readonly glyph?: string;
  readonly source?: 'user';
  readonly removed?: boolean;
}
