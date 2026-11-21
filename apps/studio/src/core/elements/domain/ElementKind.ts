/**
 * What kind of caption node an addressable element is: the kinds a
 * caption document holds, in the order they wrap one another.
 */
export const CAPTION_ELEMENT_KINDS = ['segment', 'line', 'word', 'decoration'] as const;

export type CaptionElementKind = typeof CAPTION_ELEMENT_KINDS[number];

/**
 * What kind of thing an addressable element is: one of a caption's
 * nodes, or a `layer` — something a shot draws on the frame, a b-roll
 * or a picture, whose id is its shot layer's.
 *
 * Carried alongside anything keyed by element id, because an id on its
 * own says nothing about what it points at and the answer changes
 * behaviour: a reflow dissolves a segment's identity, so work attached
 * to a segment has to exclude it. Words survive — the derivation
 * regroups them, it never recreates them. A layer belongs to the
 * project rather than to a caption document, which is why its styles
 * are kept with the shots.
 */
export const ELEMENT_KINDS = [...CAPTION_ELEMENT_KINDS, 'layer'] as const;

export type ElementKind = typeof ELEMENT_KINDS[number];
