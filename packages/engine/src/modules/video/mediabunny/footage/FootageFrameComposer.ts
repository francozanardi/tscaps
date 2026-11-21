import type { FootageLayerFrameState } from '@modules/video/FootageLayerFrameState';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { PlacedSourcePicture } from '@modules/video/SourcePicturePlacement';

/**
 * The frame shown at one moment, and what a consumer drawing over it
 * needs to know of it.
 *
 * `frame` is null where what would be drawn is the source's frame as it
 * is. Where backdrop layers are active on it, `beneathBackdrops` is what
 * lay beneath them before they drew it again: the frame composed up to
 * the first of them, and the state each backdrop drew it in, bottom to
 * top; whatever is cut out of the picture to be laid over it again (an
 * actor over captions) is cut from that frame and drawn in those states,
 * so it moves, blurs and fades as the picture does.
 *
 * `sourcePicture` is where the source's own picture landed on the frame
 * such a cut is taken from — `beneathBackdrops.frame` where there is
 * one, the frame shown otherwise — or null where a layer hides it
 * entirely. The caller owns every frame and closes it.
 */
export interface ComposedFootageFrame {
  readonly frame: DecodedVideoFrame | null;
  readonly sourcePicture: PlacedSourcePicture | null;
  readonly beneathBackdrops: {
    readonly frame: DecodedVideoFrame;
    readonly states: ReadonlyArray<FootageLayerFrameState>;
  } | null;
}

/**
 * Composes the frames of the stretches where footage layers are drawn
 * on the source's picture.
 *
 * Lifecycle mirrors the top layer's: {@link open} prepares a run
 * at the given output dimensions, {@link frameFor} is asked in
 * monotonically advancing output time for a transcode and in any order
 * for single frames, and {@link close} releases everything. A composer
 * serves one render at a time.
 */
export interface FootageFrameComposer {
  /** `sourceWidth × sourceHeight` is the source's own picture size, whose shape the output's need not share. */
  open(width: number, height: number, sourceWidth: number, sourceHeight: number): Promise<void>;

  /**
   * The frame shown at `outputSec`: `sourceFrame` with the layers active
   * there drawn on it, carrying its timestamp and duration — or a null
   * `frame` where what would be drawn is `sourceFrame` as it is,
   * stretched to the output, which is then of its shape — with what
   * lies beneath its backdrops and where the source's picture landed.
   * Does not close `sourceFrame`. The caller owns the frames returned and
   * closes them.
   */
  frameFor(outputSec: number, sourceFrame: DecodedVideoFrame): Promise<ComposedFootageFrame>;

  close(): Promise<void>;
}
