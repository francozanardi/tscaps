/** Every vertical measurement of one timeline row, in pixels. */
export interface TimelineRowGeometry {
  /** The row block on its own, without the space to the next one. */
  readonly cardHeightPx: number;
  /** What a list must reserve for this row, that space included. */
  readonly totalHeightPx: number;
  readonly paddingPx: number;
  readonly innerGapPx: number;
  readonly spacingPx: number;
  readonly headerHeightPx: number;
  readonly trackHeightPx: number;
  readonly trackPaddingPx: number;
  /** The single band holding every word, or every scene as a block. */
  readonly channelHeightPx: number;
  /**
   * Where that band starts, measured from the top of the surface a row
   * hands presses to — the ruler included, since it is part of it.
   */
  readonly channelTopPx: number;
  /** How far the chips start below the channel's top edge. */
  readonly chipInsetTopPx: number;
  readonly chipHeightPx: number;
  readonly waveformHeightPx: number;
}

const CHIP_HEIGHT_PX = 29;
const CHANNEL_RING_PX = 1;

/** Bare channel showing past everything it holds, top and bottom. */
const CHANNEL_PADDING_PX = 3;

// The inset ring eats the channel's first and last pixel, so counting it
// on both sides is what leaves as much channel showing over the chips as
// under them.
const CHIP_INSET_PX = CHANNEL_PADDING_PX + CHANNEL_RING_PX;
const TRACK_PADDING_PX = 4;
const HEADER_HEIGHT_PX = 18;
const WAVEFORM_HEIGHT_PX = 32;

/** A row's own breathing room, at the same rhythm as its contents. */
const INNER_GAP_PX = 6;
const PADDING_PX = INNER_GAP_PX;

/**
 * Between one row and the next. Small on purpose: a row is drawn as a
 * filled block, so the gap only has to let its edge be seen.
 */
const SPACING_PX = 10;

/**
 * Works out how tall a row is and how tall each of its parts is.
 *
 * One resolver answers both questions on purpose. The virtualized list
 * has to place a row before it is ever drawn, so its total height must
 * be known up front; deriving that total from the very fields the row
 * is styled with is what stops the two from being different sums.
 *
 * Every row of a timeline is the same height. Nothing a row holds can
 * change it — one channel whatever the scenes do, and the same channel
 * whichever level it is read at, so switching level never moves the
 * reader. Stacking a bar per overlapping scene is what this replaced,
 * and it made a row's height depend on what happened to run through it.
 */
export class TimelineRowGeometryResolver {

  resolve(hasWaveform: boolean): TimelineRowGeometry {
    const channelHeightPx = CHIP_INSET_PX * 2 + CHIP_HEIGHT_PX;
    const trackHeightPx = channelHeightPx + TRACK_PADDING_PX * 2;
    const waveformBlockPx = hasWaveform ? INNER_GAP_PX + WAVEFORM_HEIGHT_PX : 0;
    const cardHeightPx = PADDING_PX * 2
      + HEADER_HEIGHT_PX
      + INNER_GAP_PX
      + trackHeightPx
      + waveformBlockPx;
    return {
      cardHeightPx,
      totalHeightPx: cardHeightPx + SPACING_PX,
      paddingPx: PADDING_PX,
      innerGapPx: INNER_GAP_PX,
      spacingPx: SPACING_PX,
      headerHeightPx: HEADER_HEIGHT_PX,
      trackHeightPx,
      trackPaddingPx: TRACK_PADDING_PX,
      channelHeightPx,
      channelTopPx: HEADER_HEIGHT_PX + INNER_GAP_PX + TRACK_PADDING_PX,
      chipInsetTopPx: CHIP_INSET_PX,
      chipHeightPx: CHIP_HEIGHT_PX,
      waveformHeightPx: WAVEFORM_HEIGHT_PX,
    };
  }
}
