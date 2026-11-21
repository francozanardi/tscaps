/**
 * The kinds of things an operation can point at: the caption nodes
 * (`segment`, `line`, `word`, `decoration`), a shot's `layer` (a file or a
 * graphic on it), a `shot` of the shot partition, a style `sheet`, and a
 * `sound` clip of the soundtrack.
 */
export const EDITOR_REF_KINDS = ['segment', 'line', 'word', 'decoration', 'layer', 'shot', 'sheet', 'sound'] as const;

export type EditorRefKind = typeof EDITOR_REF_KINDS[number];

/**
 * A pointer at one thing in the open project, written `kind:id` wherever
 * it travels as text (`word:Hk3…`). The kind travels with the id because
 * an id alone says nothing about what it points at, and the id can hold
 * colons of its own (a decoration's id is built from its word's), so the
 * text splits on the first colon only.
 */
export interface EditorRef {
  readonly kind: EditorRefKind;
  readonly id: string;
}
