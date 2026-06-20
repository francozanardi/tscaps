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

  SECTION_STARTS = '--on-section-starts',
  SECTION_ENDS = '--on-section-ends',
  SECTION_DURATION = '--section-duration',

  SEGMENT_STARTS = '--on-segment-starts',
  SEGMENT_ENDS = '--on-segment-ends',
  SEGMENT_DURATION = '--segment-duration',
  SEGMENT_CHAR_COUNT = '--segment-char-count',

  LINE_NOT_NARRATED_YET_STARTS = '--on-line-not-narrated-yet-starts',
  LINE_NOT_NARRATED_YET_ENDS = '--on-line-not-narrated-yet-ends',
  LINE_NOT_NARRATED_YET_DURATION = '--line-not-narrated-yet-duration',
  LINE_BEING_NARRATED_STARTS = '--on-line-being-narrated-starts',
  LINE_BEING_NARRATED_ENDS = '--on-line-being-narrated-ends',
  LINE_BEING_NARRATED_DURATION = '--line-being-narrated-duration',
  LINE_ALREADY_NARRATED_STARTS = '--on-line-already-narrated-starts',
  LINE_ALREADY_NARRATED_ENDS = '--on-line-already-narrated-ends',
  LINE_ALREADY_NARRATED_DURATION = '--line-already-narrated-duration',

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
  WORD_COUNT = '--word-count',
  LAST_WORD_CHAR_COUNT = '--last-word-char-count',

  VIDEO_FRAME = '--video-frame',
  SUBTITLE_REGION_WIDTH = '--subtitle-region-width',
  SUBTITLE_REGION_HEIGHT = '--subtitle-region-height',
  SUBTITLE_REGION_X = '--subtitle-region-x',
  SUBTITLE_REGION_Y = '--subtitle-region-y',

  SEGMENT_PADDING_TOP = '--segment-padding-top',
  SEGMENT_PADDING_BOTTOM = '--segment-padding-bottom',

  // ── Consumer-written ───────────────────────────────────────────
  // The engine's baseline CSS reads these with sensible defaults;
  // the consumer sets them per-sheet to override the default.

  DECORATION_FONT_SIZE_MULTIPLIER = '--decoration-font-size-multiplier',
  DECORATION_GAP_MULTIPLIER = '--decoration-gap-multiplier',
}
