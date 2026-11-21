/**
 * Something on the edit a sound is placed against, which moves when the
 * edit does: a word of the Original track at its start or end, an emoji
 * of the Original track (on its word's start, while its captions show
 * it), a shot
 * at its start or end, the transition into a shot (on the cut it plays
 * over, for as long as the shot has one), a shot's camera move (on the
 * shot's start, for as long as the shot has one), a shot layer's camera
 * move (on the layer's start, for as long as it has one), a shot layer at its entry or
 * exit, the transition a shot layer's layout plays at its entrance or
 * exit (a split's line, a box's way from or to the whole frame), a moment
 * a graphic layer's code declared (a button pressed), or the video at its
 * start or end. Ids name what they point at; nothing here says
 * whether it still exists.
 */
export type AudioAnchor =
  | { readonly kind: 'word'; readonly wordId: string; readonly edge: 'start' | 'end' }
  | { readonly kind: 'emoji'; readonly decorationId: string }
  | { readonly kind: 'shot'; readonly shotId: string; readonly edge: 'start' | 'end' }
  | { readonly kind: 'transition'; readonly shotId: string }
  | { readonly kind: 'camera'; readonly shotId: string }
  | { readonly kind: 'layer-camera'; readonly layerId: string }
  | { readonly kind: 'layer'; readonly layerId: string; readonly edge: 'entry' | 'exit' }
  | { readonly kind: 'layer-transition'; readonly layerId: string; readonly edge: 'entrance' | 'exit' }
  | { readonly kind: 'layer-moment'; readonly layerId: string; readonly momentId: string }
  | { readonly kind: 'video'; readonly edge: 'start' | 'end' };
