/**
 * CSS custom properties published on the rendered subtree so the
 * consumer's stylesheet can react to playback timing and node
 * structure, plus a small set the consumer writes back so the engine's
 * baseline rules pick up per-sheet overrides.
 *
 * Each entry is owned by whichever side **writes** it; once published,
 * any reader (engine baseline CSS, consumer template CSS, JS
 * inspection) can pick it up.
 *
 * Naming:
 *  - `--on-<x>-starts` / `--on-<x>-ends` are *event timestamps*: they
 *    encode the moment (relative to `currentTime`, in seconds) at which
 *    state `<x>` begins or ends. Negative values mean the event is in
 *    the past.
 *  - `--<x>-duration` is a *span*, not an event. It does not coincide
 *    with any moment, so it carries no `on-` prefix.
 *  - Structural metadata (letter index, character count, …) carries no
 *    `on-` prefix either — those are not events.
 */
export enum CssVariable {
  // ── Engine-written ─────────────────────────────────────────────
  // Published by the engine on every render. The consumer's
  // stylesheet reads them through `var(...)` to drive animations,
  // pick up structural metadata, or paint the video frame.

  SEGMENT_STARTS = '--on-segment-starts',
  SEGMENT_ENDS = '--on-segment-ends',
  SEGMENT_DURATION = '--segment-duration',
  SEGMENT_CHAR_COUNT = '--segment-char-count',
  SEGMENT_WIDTH_EM = '--segment-width-em',
  SEGMENT_INDEX = '--segment-index',

  LINE_NOT_NARRATED_YET_STARTS = '--on-line-not-narrated-yet-starts',
  LINE_NOT_NARRATED_YET_ENDS = '--on-line-not-narrated-yet-ends',
  LINE_NOT_NARRATED_YET_DURATION = '--line-not-narrated-yet-duration',
  LINE_BEING_NARRATED_STARTS = '--on-line-being-narrated-starts',
  LINE_BEING_NARRATED_ENDS = '--on-line-being-narrated-ends',
  LINE_BEING_NARRATED_DURATION = '--line-being-narrated-duration',
  LINE_ALREADY_NARRATED_STARTS = '--on-line-already-narrated-starts',
  LINE_ALREADY_NARRATED_ENDS = '--on-line-already-narrated-ends',
  LINE_ALREADY_NARRATED_DURATION = '--line-already-narrated-duration',
  LINE_CHAR_COUNT = '--line-char-count',
  LINE_WIDTH_EM = '--line-width-em',
  PREVIOUS_LINE_WIDTH_EM = '--previous-line-width-em',
  LINE_INK_ASCENT_EM = '--line-ink-ascent-em',
  LINE_INK_DESCENT_EM = '--line-ink-descent-em',

  WORD_NOT_NARRATED_YET_STARTS = '--on-word-not-narrated-yet-starts',
  WORD_NOT_NARRATED_YET_ENDS = '--on-word-not-narrated-yet-ends',
  WORD_NOT_NARRATED_YET_DURATION = '--word-not-narrated-yet-duration',
  WORD_BEING_NARRATED_STARTS = '--on-word-being-narrated-starts',
  WORD_BEING_NARRATED_ENDS = '--on-word-being-narrated-ends',
  WORD_BEING_NARRATED_DURATION = '--word-being-narrated-duration',
  WORD_ALREADY_NARRATED_STARTS = '--on-word-already-narrated-starts',
  WORD_ALREADY_NARRATED_ENDS = '--on-word-already-narrated-ends',
  WORD_ALREADY_NARRATED_DURATION = '--word-already-narrated-duration',

  LETTER_INDEX = '--letter-index',
  LETTER_COUNT = '--letter-count',

  WORD_INDEX = '--word-index',
  WORD_CHAR_COUNT = '--word-char-count',
  WORD_WIDTH_EM = '--word-width-em',
  WORD_COUNT = '--word-count',
  LAST_WORD_CHAR_COUNT = '--last-word-char-count',

  VIDEO_FRAME = '--video-frame',
  SUBTITLE_REGION_WIDTH = '--subtitle-region-width',
  SUBTITLE_REGION_HEIGHT = '--subtitle-region-height',
  SUBTITLE_REGION_X = '--subtitle-region-x',
  SUBTITLE_REGION_Y = '--subtitle-region-y',

  SEGMENT_PADDING_TOP = '--segment-padding-top',
  SEGMENT_PADDING_BOTTOM = '--segment-padding-bottom',

  SEGMENT_ANCHOR_Y = '--segment-anchor-y',
  SEGMENT_ANCHOR_ORIGIN_Y = '--segment-anchor-origin-y',

  // On a footage layer's box: the moment the layer comes onto the
  // frame and the moment it leaves, and how long it stays.
  LAYER_STARTS = '--on-layer-starts',
  LAYER_ENDS = '--on-layer-ends',
  LAYER_DURATION = '--layer-duration',

  // ── Consumer-written ───────────────────────────────────────────
  // Set by the consumer's stylesheet and read by the engine, never
  // written by it.

  // Read by the engine's baseline CSS, which gives each a default.
  DECORATION_FONT_SIZE_MULTIPLIER = '--decoration-font-size-multiplier',
  DECORATION_GAP_MULTIPLIER = '--decoration-gap-multiplier',

  // Where the render's own video is drawn while a footage layer
  // shows, declared on that layer's box and read back from it by the
  // engine, as lengths of the stage. All four, or the video keeps its
  // own place in the frame.
  VIDEO_LEFT = '--video-left',
  VIDEO_TOP = '--video-top',
  VIDEO_WIDTH = '--video-width',
  VIDEO_HEIGHT = '--video-height',
  // `1` draws that video over the layer declaring it, in its rect, rather
  // than beneath every layer; and the radius its rect's corners are
  // rounded by there, a length of the stage.
  VIDEO_ABOVE = '--video-above',
  VIDEO_RADIUS = '--video-radius',

  // The radius, a length of the stage, of a blurred copy of a footage
  // layer's own picture filling its box beneath a picture fitted inside
  // it; none where unset or zero.
  PICTURE_FILL_BLUR = '--picture-fill-blur',

  // Where a footage layer is cut off: a rect of the stage, declared on
  // its box as lengths of the stage, that nothing of it is drawn outside,
  // and the radius its corners are rounded by there. The rect moves,
  // turns and fades with the box. All four sides, or nothing is cut.
  CLIP_LEFT = '--clip-left',
  CLIP_TOP = '--clip-top',
  CLIP_WIDTH = '--clip-width',
  CLIP_HEIGHT = '--clip-height',
  CLIP_RADIUS = '--clip-radius',
}
