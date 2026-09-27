/**
 * CSS classes the framework publishes on rendered elements as part of
 * its stylesheet contract, mirroring how `CssVariable` names the
 * published custom properties. Two kinds live here: state classes
 * that appear and disappear with framework-driven conditions, and
 * classes on elements the renderer itself creates (layers and
 * containers that are not document nodes). Structural node classes
 * stay on their node class (`Segment.CSS_CLASS`, `Word.CSS_CLASS`, …).
 */
export enum CssClass {
  /** On `.segment` while the text-behind-actor effect is active for it; absent otherwise. */
  BEHIND_ACTOR_ACTIVE = 'behind-actor-active',

  /** On the layer element emitted inside `.segment` when `RenderingConfig.videoFrame.required` is set. Stylesheets target it to position, clip, or filter the video frame. */
  VIDEO_FRAME_LAYER = 'tscaps-video-frame-layer',

  /** On a `.word` element painting a piece of its word that the bidi algorithm placed away from the rest of it. */
  DETACHED_WORD_FRAGMENT = 'detached-word-fragment',

  /** On the container of decorations promoted above the segment's text. */
  SEGMENT_DECORATIONS_ABOVE = 'segment-decorations-above',

  /** On the container of decorations promoted below the segment's text. */
  SEGMENT_DECORATIONS_BELOW = 'segment-decorations-below',
}
