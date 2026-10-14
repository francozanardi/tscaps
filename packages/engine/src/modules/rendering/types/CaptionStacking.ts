/**
 * Where a caption subtree sits relative to the top layer.
 *
 * The frame is composited bottom to top: the video, the overlay, the
 * captions under the top layer, the top layer, the captions over it.
 * A subtree under the top layer is occluded wherever the top layer
 * paints; one over it is not. Every caption is under it unless told
 * otherwise.
 */
export enum CaptionStacking {
  UNDER_TOP_LAYER = 'under-top-layer',
  OVER_TOP_LAYER = 'over-top-layer',
}
