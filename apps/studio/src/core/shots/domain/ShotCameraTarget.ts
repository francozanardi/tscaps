/**
 * Whose camera an edit is on: a shot's own video, cut by the frame, or a
 * shot layer's picture, cut by the layer's box (a split's part, a
 * floating box, the whole frame).
 */
export type ShotCameraTarget =
  | { readonly kind: 'shot'; readonly shotId: string }
  | { readonly kind: 'layer'; readonly layerId: string };
