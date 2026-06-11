/**
 * CSS custom properties exposed on each rendered node so consumers can
 * react to playback timing.
 *
 * Naming:
 *  - `--on-<x>-starts` / `--on-<x>-ends` are *event timestamps*: they
 *    encode the moment (relative to `currentTime`, in seconds) at which
 *    state `<x>` begins or ends. Negative values mean the event is in
 *    the past.
 *  - `--<x>-duration` is a *span*, not an event. It does not coincide
 *    with any moment, so it carries no `on-` prefix.
 */
export enum CssVariable {
  SECTION_STARTS = '--on-section-starts',
  SECTION_ENDS = '--on-section-ends',
  SECTION_DURATION = '--section-duration',

  SEGMENT_STARTS = '--on-segment-starts',
  SEGMENT_ENDS = '--on-segment-ends',
  SEGMENT_DURATION = '--segment-duration',

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

  VIDEO_FRAME = '--video-frame',
  SUBTITLE_REGION_WIDTH = '--subtitle-region-width',
  SUBTITLE_REGION_HEIGHT = '--subtitle-region-height',
  SUBTITLE_REGION_X = '--subtitle-region-x',
  SUBTITLE_REGION_Y = '--subtitle-region-y',
}
